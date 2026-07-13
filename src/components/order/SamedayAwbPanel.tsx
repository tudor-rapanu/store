"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PickupPoint = {
  id: string;
  name: string;
  address?: string;
  contactPersons: {
    id: string;
    name: string;
    isDefault: boolean;
  }[];
};

type County = {
  id: number;
  name: string;
};

type City = {
  id: number;
  name: string;
  postalCode?: string;
};

type SamedayAwbPanelProps = {
  orderId: string;
  paymentStatus: string;
  shippingMethod: "address" | "easybox" | "international";
  awbNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  address: {
    street?: string;
    city?: string;
    county?: string;
    zip?: string;
    samedayCountyId?: string;
    samedayCityId?: string;
    samedayLockerId?: string;
    samedayLockerOohType?: number | string;
  };
};

function getSamedayAwbDescription({
  awbNumber,
  paymentStatus,
  shippingMethod,
}: Pick<SamedayAwbPanelProps, "awbNumber" | "paymentStatus" | "shippingMethod">) {
  if (awbNumber) {
    return `Generated AWB ${awbNumber}`;
  }

  if (paymentStatus !== "paid") {
    return "Mark the order as paid before generating an AWB.";
  }

  return shippingMethod === "easybox"
    ? "Generate an Easybox delivery AWB for this paid order."
    : "Generate a home delivery AWB for this paid order.";
}

export function SamedayAwbPanel({
  orderId,
  paymentStatus,
  shippingMethod,
  awbNumber,
  trackingUrl,
  address,
}: SamedayAwbPanelProps) {
  const isInternational = shippingMethod === "international";
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [citySearch, setCitySearch] = useState(address.city ?? "");

  const [pickupPointId, setPickupPointId] = useState("");
  const [contactPersonId, setContactPersonId] = useState("");
  const [countyId, setCountyId] = useState(address.samedayCountyId ?? "");
  const [cityId, setCityId] = useState(address.samedayCityId ?? "");
  const [packageType, setPackageType] = useState("1");
  const [weight, setWeight] = useState("1");
  const [width, setWidth] = useState("18");
  const [length, setLength] = useState("26.5");
  const [height, setHeight] = useState("1");
  const [observation, setObservation] = useState("");
  const [personalEasyboxLoad, setPersonalEasyboxLoad] = useState(false);

  const selectedPickupPoint = useMemo(
    () => pickupPoints.find((point) => point.id === pickupPointId),
    [pickupPointId, pickupPoints],
  );
  const selectedPickupPointContactIds = useMemo(
    () =>
      new Set((selectedPickupPoint?.contactPersons ?? []).map((contact) => contact.id)),
    [selectedPickupPoint],
  );
  const activeContactPersonId = selectedPickupPointContactIds.has(contactPersonId)
    ? contactPersonId
    : "";
  const canGenerate = paymentStatus === "paid" && !awbNumber;
  const canSubmitAwb =
    canGenerate &&
    Boolean(pickupPointId) &&
    Boolean(activeContactPersonId) &&
    Boolean(countyId) &&
    Boolean(cityId);

  const getDefaultContactId = useCallback((point: PickupPoint | undefined) => {
    const defaultContact =
      point?.contactPersons.find((contact) => contact.isDefault) ??
      point?.contactPersons[0];

    return defaultContact?.id ?? "";
  }, []);

  const selectPickupPoint = useCallback(
    (pointId: string, points = pickupPoints) => {
      setPickupPointId(pointId);
      setContactPersonId(
        getDefaultContactId(points.find((point) => point.id === pointId)),
      );
    },
    [getDefaultContactId, pickupPoints],
  );

  useEffect(() => {
    if (isInternational || !isOpen || pickupPoints.length > 0 || counties.length > 0) {
      return;
    }

    async function loadData() {
      setIsLoadingData(true);
      setMessage(null);

      try {
        const [pickupResponse, countiesResponse] = await Promise.all([
          fetch("/api/admin/shipping/sameday/pickup-points"),
          fetch("/api/admin/shipping/sameday/counties"),
        ]);
        const pickupData = (await pickupResponse.json()) as {
          pickupPoints?: PickupPoint[];
          error?: string;
        };
        const countiesData = (await countiesResponse.json()) as {
          counties?: County[];
          error?: string;
        };

        if (!pickupResponse.ok) {
          throw new Error(pickupData.error ?? "Could not load Sameday pickup points.");
        }

        if (!countiesResponse.ok) {
          throw new Error(countiesData.error ?? "Could not load counties.");
        }

        const nextPickupPoints = pickupData.pickupPoints ?? [];
        const nextCounties = countiesData.counties ?? [];
        setPickupPoints(nextPickupPoints);
        setCounties(nextCounties);

        if (nextPickupPoints.length > 0) {
          selectPickupPoint(nextPickupPoints[0].id, nextPickupPoints);
        }

        if (!countyId && address.county) {
          const matchedCounty = nextCounties.find(
            (county) => county.name.toLowerCase() === address.county?.toLowerCase(),
          );
          if (matchedCounty) {
            setCountyId(String(matchedCounty.id));
          }
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not load Sameday data.",
        );
      } finally {
        setIsLoadingData(false);
      }
    }

    void loadData();
  }, [
    address.county,
    counties.length,
    countyId,
    isInternational,
    isOpen,
    pickupPoints.length,
    selectPickupPoint,
  ]);

  useEffect(() => {
    if (isInternational || !countyId) {
      return;
    }

    void loadCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countyId, isInternational]);

  async function loadCities() {
    if (!countyId) {
      setMessage("Choose a county first.");
      return;
    }

    setMessage(null);
    const url = new URL("/api/admin/shipping/sameday/cities", window.location.origin);
    url.searchParams.set("countyId", countyId);
    if (citySearch.trim()) {
      url.searchParams.set("name", citySearch.trim());
    }

    const response = await fetch(url);
    const data = (await response.json()) as {
      cities?: City[];
      error?: string;
    };

    if (!response.ok) {
      setMessage(data.error ?? "Could not load cities.");
      return;
    }

    setCities(data.cities ?? []);
  }

  async function generateAwb() {
    setMessage(null);
    setIsGenerating(true);
    const payload = {
      pickupPointId,
      contactPersonId: activeContactPersonId,
      packageType,
      packageWeight: weight,
      packageWidth: width,
      packageLength: length,
      packageHeight: height,
      countyId,
      cityId,
      observation,
      personalEasyboxLoad,
    };

    console.log("Generate Home AWB clicked:", {
      orderId,
      shippingMethod,
      payload,
    });

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/generate-awb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      console.log("Generate AWB API response:", {
        status: response.status,
        ok: response.ok,
        data,
      });

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not generate AWB.");
      }

      setMessage("AWB generated and tracking email sent.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate AWB.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (isInternational) {
    return (
      <section className="space-y-3 border border-black p-4">
        <h2 className="text-sm font-black uppercase tracking-widest">Shipping Label</h2>
        <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Posta Romana international shipping is selected. Sameday AWB generation is not
          available for this order.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 border border-black p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest">Sameday AWB</h2>
          <p className="mt-1 text-sm text-slate-600">
            {getSamedayAwbDescription({ awbNumber, paymentStatus, shippingMethod })}
          </p>
        </div>
        {!awbNumber && (
          <Button
            type="button"
            disabled={!canGenerate}
            onClick={() => setIsOpen((current) => !current)}
            className="h-10 rounded-none bg-black text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isOpen ? "Close" : "Generate AWB"}
          </Button>
        )}
      </div>

      {awbNumber && (
        <div className="flex flex-wrap gap-2">
          {trackingUrl && (
            <Button
              asChild
              variant="outline"
              className="rounded-none border-black text-xs font-bold uppercase tracking-widest"
            >
              <a href={trackingUrl} target="_blank" rel="noreferrer">
                Open Tracking
              </a>
            </Button>
          )}
          {awbNumber && (
            <Button
              asChild
              className="rounded-none bg-black text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-900"
            >
              <a
                href={`/api/admin/orders/${orderId}/awb-label`}
                target="_blank"
                rel="noreferrer"
              >
                Open Label
              </a>
            </Button>
          )}
        </div>
      )}

      {isOpen && !awbNumber && (
        <div className="space-y-5 border-t border-black pt-4">
          {isLoadingData ? (
            <div className="text-sm font-bold uppercase tracking-widest text-slate-500">
              Loading Sameday data...
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Pickup point"
                  value={pickupPointId}
                  onChange={selectPickupPoint}
                  options={pickupPoints.map((point) => ({
                    value: point.id,
                    label: point.name,
                  }))}
                />
                {(selectedPickupPoint?.contactPersons.length ?? 0) > 0 ? (
                  <SelectField
                    label="Contact person"
                    value={activeContactPersonId}
                    onChange={setContactPersonId}
                    options={(selectedPickupPoint?.contactPersons ?? []).map(
                      (contact) => ({
                        value: contact.id,
                        label: contact.name,
                      }),
                    )}
                  />
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest">
                      Contact person
                    </Label>
                    <div className="border border-red-200 bg-red-50 p-3 text-xs font-bold uppercase tracking-wider text-red-700">
                      This pickup point has no contact person returned by Sameday.
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Sameday county"
                  value={countyId}
                  onChange={(value) => {
                    setCountyId(value);
                    setCityId("");
                    setCities([]);
                  }}
                  options={counties.map((county) => ({
                    value: String(county.id),
                    label: county.name,
                  }))}
                />
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest">
                    Search city
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={citySearch}
                      onChange={(event) => setCitySearch(event.target.value)}
                      className="h-10 rounded-none border-black"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={loadCities}
                      className="h-10 rounded-none border-black text-xs font-bold uppercase tracking-widest"
                    >
                      Search
                    </Button>
                  </div>
                </div>
              </div>

              <SelectField
                label="Sameday city"
                value={cityId}
                onChange={setCityId}
                options={cities.map((city) => ({
                  value: String(city.id),
                  label: city.postalCode
                    ? `${city.name} (${city.postalCode})`
                    : city.name,
                }))}
              />

              <div className="grid gap-4 md:grid-cols-5">
                <SelectField
                  label="Package"
                  value={packageType}
                  onChange={setPackageType}
                  options={[
                    { value: "1", label: "Small" },
                    { value: "0", label: "Parcel" },
                    { value: "2", label: "Large" },
                  ]}
                />
                <NumberField label="Weight" value={weight} onChange={setWeight} />
                <NumberField label="Width" value={width} onChange={setWidth} />
                <NumberField label="Length" value={length} onChange={setLength} />
                <NumberField label="Height" value={height} onChange={setHeight} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest">
                  Observation
                </Label>
                <Input
                  value={observation}
                  onChange={(event) => setObservation(event.target.value)}
                  className="h-10 rounded-none border-black"
                />
              </div>

              <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-700">
                <input
                  type="checkbox"
                  checked={personalEasyboxLoad}
                  onChange={(event) => setPersonalEasyboxLoad(event.target.checked)}
                  className="size-4 border-black"
                />
                I will personally load this package in an Easybox.
              </label>

              {personalEasyboxLoad && (
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  The PDO service tax id will be fetched from your Sameday services.
                </p>
              )}

              <Button
                type="button"
                disabled={!canSubmitAwb || isGenerating}
                onClick={generateAwb}
                className="h-12 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Generate Home AWB"}
              </Button>
            </>
          )}
        </div>
      )}

      {message && (
        <div className="border border-black p-3 text-sm font-bold uppercase tracking-wider">
          {message}
        </div>
      )}
    </section>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-widest">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-none border-black">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-widest">{label}</Label>
      <Input
        type="number"
        step="0.1"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-none border-black"
      />
    </div>
  );
}
