"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchCachedJson } from "@/lib/client/api-cache";

type SamedayCounty = {
  id: number;
  name: string;
};

type SamedayCity = {
  id: number;
  name: string;
  postalCode?: string;
};

export type SamedayLocationSelection = {
  countyId: string;
  countyName: string;
  cityId: string;
  cityName: string;
  cityPostalCode?: string;
};

type SamedayLocationPickerProps = {
  initialCountyId?: string;
  initialCountyName?: string;
  initialCityId?: string;
  initialCityName?: string;
  countyIdName?: string;
  countyNameName?: string;
  cityIdName?: string;
  cityNameName?: string;
  onSelectionChange?: (selection: SamedayLocationSelection) => void;
};

export function SamedayLocationPicker({
  initialCountyId = "",
  initialCountyName = "",
  initialCityId = "",
  initialCityName = "",
  countyIdName = "samedayCountyId",
  countyNameName = "county",
  cityIdName = "samedayCityId",
  cityNameName = "city",
  onSelectionChange,
}: SamedayLocationPickerProps) {
  const [counties, setCounties] = useState<SamedayCounty[]>([]);
  const [cities, setCities] = useState<SamedayCity[]>([]);
  const [countyId, setCountyId] = useState(initialCountyId);
  const [countyName, setCountyName] = useState(initialCountyName);
  const [cityId, setCityId] = useState(initialCityId);
  const [cityName, setCityName] = useState(initialCityName);
  const [cityQuery, setCityQuery] = useState(initialCityName);
  const [isCityListOpen, setIsCityListOpen] = useState(false);
  const [isLoadingCounties, setIsLoadingCounties] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadCounties() {
      setIsLoadingCounties(true);

      try {
        const data = await fetchCachedJson<{
          counties?: SamedayCounty[];
          error?: string;
        }>("shipping:sameday:counties", "/api/shipping/sameday/counties", {
          ttlMs: 60 * 60 * 1000,
        });

        setCounties(data.counties ?? []);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load counties.",
        );
      } finally {
        setIsLoadingCounties(false);
      }
    }

    void loadCounties();
  }, []);

  useEffect(() => {
    if (!countyId) {
      return;
    }

    let isCancelled = false;
    const timeout = window.setTimeout(async () => {
      setIsLoadingCities(true);
      setErrorMessage(null);

      try {
        const citySearch = cityQuery.trim();
        const requestSearch = citySearch && citySearch !== cityName ? citySearch : "";
        const url = new URL("/api/shipping/sameday/cities", window.location.origin);
        url.searchParams.set("countyId", countyId);

        if (requestSearch) {
          url.searchParams.set("name", requestSearch);
        }

        const data = await fetchCachedJson<{
          cities?: SamedayCity[];
          error?: string;
        }>(`shipping:sameday:cities:${countyId}:${requestSearch}`, url, {
          ttlMs: 10 * 60 * 1000,
        });

        if (isCancelled) {
          return;
        }

        setCities(data.cities ?? []);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Could not load cities.",
        );
      } finally {
        setIsLoadingCities(false);
      }
    }, 200);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [cityName, cityQuery, countyId]);

  useEffect(() => {
    onSelectionChange?.({
      countyId,
      countyName,
      cityId,
      cityName,
      cityPostalCode: cities.find((city) => String(city.id) === cityId)?.postalCode,
    });
  }, [cities, cityId, cityName, countyId, countyName, onSelectionChange]);

  function selectCounty(value: string) {
    const county = counties.find((item) => String(item.id) === value);
    setCountyId(value);
    setCountyName(county?.name ?? "");
    setCityId("");
    setCityName("");
    setCityQuery("");
    setCities([]);
    setIsCityListOpen(false);
  }

  function selectCity(city: SamedayCity) {
    setCityId(String(city.id));
    setCityName(city.name);
    setCityQuery(city.name);
    setIsCityListOpen(false);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name={countyIdName} value={countyId} />
      <input type="hidden" name={countyNameName} value={countyName} />
      <input type="hidden" name={cityIdName} value={cityId} />
      <input type="hidden" name={cityNameName} value={cityName} />

      <div className="space-y-2">
        <Label className="uppercase text-xs font-bold tracking-widest">County</Label>
        <Select
          value={countyId}
          onValueChange={selectCounty}
          required
          disabled={isLoadingCounties}
        >
          <SelectTrigger id="county" className="rounded-none border-black h-12">
            <SelectValue
              placeholder={isLoadingCounties ? "Loading counties" : "Select county"}
            />
          </SelectTrigger>
          <SelectContent className="rounded-none border-black bg-white">
            {counties.map((county) => (
              <SelectItem
                key={county.id}
                value={String(county.id)}
                className="uppercase text-xs font-bold"
              >
                {county.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="city-search"
          className="uppercase text-xs font-bold tracking-widest"
        >
          City
        </Label>
        <div className="relative">
          <Input
            id="city-search"
            value={cityQuery}
            onChange={(event) => {
              setCityQuery(event.target.value);
              setCityId("");
              setCityName("");
              setIsCityListOpen(true);
            }}
            onFocus={() => setIsCityListOpen(true)}
            onBlur={() => {
              window.setTimeout(() => {
                setIsCityListOpen(false);
                if (!cityId) {
                  setCityQuery("");
                }
              }, 120);
            }}
            disabled={!countyId}
            required
            className="rounded-none border-black h-12"
            placeholder={countyId ? "Type city name" : "Select county first"}
            autoComplete="off"
          />
          {isCityListOpen && countyId ? (
            <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto border border-black bg-white shadow-lg">
              {isLoadingCities ? (
                <div className="p-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                  Loading cities
                </div>
              ) : cities.length === 0 ? (
                <div className="p-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                  No cities found
                </div>
              ) : (
                cities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCity(city)}
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs font-bold uppercase tracking-widest hover:bg-slate-100"
                  >
                    {city.postalCode ? `${city.name} (${city.postalCode})` : city.name}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        {errorMessage ? (
          <p className="text-xs font-bold uppercase tracking-wider text-destructive">
            {errorMessage}
          </p>
        ) : (
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Start typing to filter Sameday-compliant cities.
          </p>
        )}
      </div>
    </div>
  );
}
