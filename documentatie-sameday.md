## Sameday Courier - English API documentation 

||**Name**|Client API||
|---|---|---|---|
||**Descriere**|Sameday Courier English API documentation||
||**Serviciu**|https://sameday-api.demo.zitec.com/||
||**Version**|3.1||
||**Date**|21.03.2025||
||**Table of content**|Contact<br>Foreword<br>Next steps<br>Client account<br>Documentation<br>Sandbox testing environment<br>Terminology used in the documentation<br>Customer structure in the Sameday system<br>The main methods required for integration<br>Authentication<br>Pick-up points & contact persons<br>Types of parcels<br>Services<br>Home delivery service (Nextday 24H)<br>Easybox parcel locker delivery (Locker Nextday)<br>PUDO Sameday Point<br>Obtain PUDO Sameday Point locations<br>Easybox return shipping (Locker Return)<br>Extra service options<br>Counties/provinces, cities and localities<br>The status of a shipment<br>URL tracking<br>API retrieval for each AWB<br>Downloading the easybox locker list<br>Show map of easybox lockers<br>Locker PlugIn SDK (React) - Javascript<br>API call examples<br>Create AWB with same country delivery (ex: RO to RO), containing one parcel - home delivery (24H)<br>Create AWB with same country delivery (ex: RO to RO), containing two parcels - home delivery (24H)<br>Local return shipping with home pickup (Standard Return)<br>Local parcel exchange shipping (SWAP)<br>Local Easybox delivery request (Locker Nextday)<br>Local shipping with personal loading (PDO) in Easybox and delivery to an Easybox (Locker Nextday)<br>Local return shipping, with delivery in easybox (Return in locker)<br>International shipping with home delivery (Crossborder HD 24H)<br>International return shipping with home pickup (Crossborder Standard Return)<br>International shipping with easybox delivery (Crossborder Locker delivery)<br>International return shipping, with delivery in easybox (Crossborder Locker return)<br>National shipping, fixed point shipping (PUDO Nextday)<br>aac<br>°<br>°<br>°<br>°<br>°<br>°<br>°<br>°<br>°<br>.<br>.<br>°<br>°<br>°<br>°<br>.<br>~Z<br>°<br>°<br>°<br>°<br>°<br>°<br>°<br>°<br>°<br>°<br>°<br>°||



## E **Contact** e 

If you have any questions regarding this manual or the SamedayRESTful Web-Service, please contact the technical support team at app.support@sameday.ro 

## f **Foreword** e 

## **Congratulations on your decision to become a Sameday customer!** 

This document will help you go through the technical documentation more easily and to understand the operational flow offered by SamedayRESTful Web-Service, so that in the end you will benefit from an easy integration with our services. 

## **Next steps** 

In order to start placing shipment orders through the SamedayAPI Service, the following steps should be followed: 

1. Obtain a client account on the integration environment. 

2. Follow the available technical documentation. 

3. Understand the sandbox offered on smd-api / documentation (or use a REST client, for example: postman) 

4. Migration 

## **Client account** 

The Sameday team, through your designated sales agent, will help you obtain a client account for your company. In order to obtain such an account, certain information concerning your business will be requested and you will also have to provide a pick-up point and at least one contact person. 

## **Documentation** 

Sameday offers the following resources for the integration of WebService: 

- The current document 

- A sandbox for our demo environment: 

If you are a customer of Sameday Romania, access: https://sameday-api.demo.zitec.com/documentation/client 

   - If you are a customer of Sameday Bulgaria, access: https://sameday-api-bg.demo.zitec.com/documentation/client 

   - If you are a customer of Sameday Hungary, access: https://sameday-api-hu.demo.zitec.com/documentation/client 

- Examples of the main requests for the delivery services in our portfolio 

## **Sandbox testing environment** 

SamedayAPI has an available sandbox that offers a testing environment for each API method and it is available in the “sandbox” tab of each method. The sandbox has an https authentication method and the credentials can be requested at app.support@sameday.ro. 

## **Terminology used in the documentation** 

Explanations for various terms used: 

Parcel - a shipment, a parcel, a parcel, an individual item. A parcel (or several) form a shipment (an awb). 

- AWB - refers to shipping. A shipment has a sender, a recipient, reimbursement, etc. An awb/a shipment consists of at least one parcel. The shipment is the one that carries the refund value and generates the transport cost and not the individual packages (parcels). AwbNumber is the tracking code of a shipment. 

ParcelNumber is the tracking code of a shipment, parcel, package. 

- Type of shipment: it can be parcel, small parcel, or large parcel (meaning oversized parcel). 

- Pick-up address/pick-up point/pick-up-point: the address of the customer work point from where a shipment is picked up. 

- Third party: a third party from whom an expedition can be raised. 

Customer contact person: contact details for a person responsible for the pick-up point; will appear on the sender's AWB. 

## **Customer structure in the Sameday system** 

To place a shipment order, the following data are required: 

The pickup points 

- Contact persons associated with pick-up points 

- Services available for the current customer account 

- Mapping of county IDs from the Sameday system 

Mapping locality IDs from the Sameday system 

These data will not change, therefore it is recommended to save them in your database. If these data will change, you will be notified in advance. 

Optional, but recommended in the case of large volumes of shipments: mapping the localities from the Sameday nomenclature. 

## **The main methods required for integration** 

## **Authentication** 

To use the Sameday RESTful Web-Service, you first need a username and a password, provided after the sign-up process. 

After a successful authentication, an authentication token will be generated, this token will be used to authorize the other methods used. The endpoint called to generate this token is POST/api/authenticate. 

Authentication will be done by sending two HTTP headers: 

X-AUTH-USERNAME - username will be sent in this header. 

- X-AUTH-PASSWORD - the password will be sent in this header. 

If the credentials are correct, the server will send an authentication token and an expiration date for this token in json format. 

Example answer: 

- `1 {` 

- `2 "token": "68831048509fe092c89aed48e2660f5da73e6341",` 

- `3 "expire_at": "2024-09-24 12:54",` 

- `4 "expire_at_utc": "2024-09-24 09:54" 5 }` 

Authentication for the rest of the methods will be done by sending the X-AUTH-TOKEN header with the value obtained in the 'token' key. The lifetime of a token is 12 hours, but if the parameter remember_me=1 is added, this token will be valid for 14 days. 

It is recommended to save the local token, in your own database, and regenerate it with "X" minutes/hours before expiration 

The authentication limit is 12 requests/IP/minute 

## **Pick-up points & contact persons** 

The endpoint used to get these ids is **GET/api/client/pickup-points** ; 

If the client has not yet defined a pickup point, or it is not the desired one, a new pickup point can be added using the POST/api/client/pickup-points endpoint or by requesting its addition by the technical support team. 

List of pick-up points: 

- It is a GET type request 

- The url is api/client/pickup-points 

- The X-AUTH-TOKEN header will be sent 

In the sandbox environment, the request will look similar to: 

The answer will be as in the screenshot below. Relevant data has been highlighted. 

Contact persons are associated with pick-up points, so, in the case of the screenshot, we will have a pick-up point with id 2, which has a contact person with id 20. 

A customer can have several pick-up points, and a pick-up point can have several contact persons, but only one contact person can be set as default. 

If, when creating an AWB, the contact person is not sent, the default contact person will be used; if there is no default contact person, a random contact person will be used to still allow saving the expedition. 

## **Types of parcels** 

Fiecare cerere de emitere a unui AWB trebuie sa contina si tipul coletului (packageType) expediat. 

Coletele se impart in trei categorii: 

PackageType: 0 

Represents a parcel weighing between 1.01 kg and 38 kg 

PackageType: 1 

Represents a package with a weight between 0.01 kg and 1.00 kg 

PackageType: 2 

It is used for overweight shipments, which weigh more than 38 kg 

In the case of overweight shipments, check with the commercial department the existing transshipment solutions. 

## **Services** 

- For local deliveries 

   - 24H - Service ID=7 

   - Retur standard - Service ID = 10 

   - Locker Nextday - Service ID = 15 

   - Locker Retur - Service ID = 24 

   - PUDO Nextday - Service ID = 57 

- For international deliveries (crossborder) 

   - Crossborder HD 24H - Service ID = 28 

   - Crossborder Retur standard - Service ID = 29 Crossborder Locker delivery - Service ID = 30 Crossborder Locker retur - Service ID = 31 

   - Crossborder PUDO Nextday - Service ID = 58 

Sameday currently delivers internationally as follows: 

- Pickup from Romania and delivery in Hungary and Bulgaria The sending customer is a legal entity in RO Bank accounts in HUF and BGN will be required for cash on delivery orders 

- Pickup from Hungary and delivery in Romania and Bulgaria 

- The sending customer is a legal entity in HU For cash on delivery orders, bank accounts in RON and BGN will be required 

- Pickup from Bulgaria and delivery in Romania and Hungary 

The sending customer is a legal entity in BG 

- For cash on delivery orders, bank accounts in RON and HUF will be required 

For international deliveries (crossborder), the API request must contain the currency of the destination country 

The Sameday services available to the logged-in client can be found by calling the **GET/api/client/services endpoint** ; 

It is not possible to add or allocate services for the client through WebService. 

To activate new services in the customer account, please contact the Sameday commercial department. 

List of services: 

It is a GET type request; 

The url is api/client/services; 

The X-AUTH-TOKEN header will be sent. 

In the sandbox environment, the request will look similar to: 

In response, a list of all your available services, paged, will be displayed. The relevant data is highlighted below: 

## **Home delivery service (Nextday 24H)** 

You will use this service for all local deliveries to your customers home/office. 

The ID for this service is 7. 

> You will find examples in the , API call examples chapter. 

## **Easybox parcel locker delivery (Locker Nextday)** 

This service is used for parcel locker deliveries. 

Service ID is 15. 

> You will find examples in the , API call examples chapter. 

## **PUDO Sameday Point** 

PUDO/Sameday Point represents the delivery service at partner commercial points, an extensive network that includes (but is not limited to) stores, gas stations and other commercial points. 

Two new services have been added to the Sameday IT system: 

PUDO NextDay (Personal pickup from a fixed point), service ID: 57 

Crossborder PUDO NextDay (Personal pickup from an international fixed point), service ID: 58 

Considering the diversification of types of fixed locations, the documentation introduces the notion of OOH, which refers to the Out-OfHome network, which includes both lockers and PUDO points. 

By adding these new services, the AWB emission endpoints were adapted to include the two services mentioned above. 

In order to have a correct integration that includes these two services, the following aspects will have to be taken into account: 

Adding the new parameters oohFirstMile and oohLastMile in the request for an AWB issuance. 

oohFirstMile = this field is used for the personal delivery option of a package and represents the ID of the respective location. 

oohLastMile = this field is used for the option of personal pick-up of a package from a PUDO location and represents the ID of the respective location. 

When issuing an AWB, through the POST endpoint: api/awb, the type of location must be taken into account, as follows: 

The PUDO type locations will have the oohType parameter with the value 1, while the easybox type locations will have the oohType parameter with the value 0. 

The easybox type locations have a range of IDs up to the value of 500,000, while the PUDO type locations will have a range of IDs with a value of over 500,000. 

**Both pairs of parameters can be used, with the mention that if you want to broadcast on the PUDO service, it is mandatory to use the new OOH parameters.** 

## **It is recommended to use the new parameters for both services, because those previously used will become decommissioned in the future.** 

To return Out Of Home (Locker + PUDO) locations, a new endpoint was created called **GET /api/client/ooh-locations** . It will replicate the features of the existing GET/api/client/lockers endpoint. 

On the new method, the listingType filter has been added, through which we will return: 

lockers only 

lockers + PUDOs 

Also, on the response of the new endpoint, the oohType field was added, as well as specialSchedule, which will contain free days and days with a special schedule. 

Additional changes were also made to the status-sync endpoints, which were adapted to include information about the new service, SAMEDAY point. 

The affected methods are: 

GET /api/client/status-sync , 

GET /api/client/xb-status-sync 

Thus, in addition to the lockerDetails collection, we will also have a new collection called **oohDetails** . 

The returned response will have identical information on both the lockerDetails and oohDetails collections, for AWBs with delivery to lockers (easybox). 

For AWBs with delivery to PUDO, we will only have information returned on the oohDetails collection. 

## **Obtain PUDO Sameday Point locations** 

It is a GET request 

The url is **/api/client/ooh-locations** 

The X-AUTH-TOKEN header will be sent 

In the sandbox environment, the request will look similar to: 

https://api.sameday.ro/api/client/ooh-locations?oohList=500162&listingType=1&countPerPage=100&countryCode=RO 

## Response example: 

- `1 { 2 "total": 1, 3 "currentPage": 1, 4 "pages": 1, 5 "perPage": 100, 6 "data": [ 7 { 8 "name": "SAMEDAY point Amaradia", => location name 9 "country": "Romania", => location country` 

- `10 "countryId": 187, 11 "county": "Dolj", => county/province name 12 "countyId": 18, => county/province ID 13 "city": "Craiova", => city name 14 "cityId": 10340, => city ID 15 "address": "Str. Amaradia, Nr. 30", 16 "postalCode": "200157",` 

- `17 "lat": 44.326978, 18 "lng": 23.792361, 19 "oohId": 500162, => location unique ID; under 500000 = Easybox parcel location; over 500000 = PUDO Sameday Point location` 

- `20 "oohType": 1, => 0 = Easybox Parcel locker; 1 = PUDO location` 

- `21 "supportedPayment": 1, => 0 = location does not accept card payment; 1 = location accepts card payment` 

- `22 "clientVisible": 1, 23 "deliveryLogisticLocationId": 225, => internal Sameday information 24 "deliveryLogisticLocation": "DJ_CRAIOVA_LN_A03", => internal Sameday information 25 "occupancyLevel": 0, => internal Sameday information 26 "email": null, 27 "phone": null,` 

**==> picture [309 x 520] intentionally omitted <==**

**----- Start of picture text -----**<br>
|||
|---|---|
|28|"oohRoute": "DJA03-R07", => internal Sameday information|
|29|"schedule": [|
|30|{|
|31|"day": 7,|
|32|"openingHour": "09:00",|
|33|"closingHour": "20:00"|
|34|},|
|35|{|
|36|"day": 6,|
|37|"openingHour": "09:00",|
|38|"closingHour": "20:00"|
|39|},|
|40|{|
|41|"day": 5,|
|42|"openingHour": "09:00",|
|43|"closingHour": "20:00"|
|44|},|
|45|{|
|46|"day": 4,|
|47|"openingHour": "09:00",|
|48|"closingHour": "20:00"|
|49|},|
|50|{|
|51|"day": 3,|
|52|"openingHour": "09:00",|
|53|"closingHour": "20:00"|
|54|},|
|55|{|
|56|"day": 2,|
|57|"openingHour": "09:00",|
|58|"closingHour": "20:00"|
|59|},|
|60|{|
|61|"day": 1,|
|62|"openingHour": "09:00",|
|63|"closingHour": "20:00"|
|64|}|
|65|],|
|66|"specialSchedule": [],|
|67|"photos": []|
|68|}|
|69|]|
|70|}|

**----- End of picture text -----**<br>


## **Easybox return shipping (Locker Return)** 

Procedure: 

- The buyer will access the online store and selects to retun the product in an Easybox. Note: Each online store will implement the necessary validations, depending on the specifics of the store (eligible products, return period, etc.) 

- The AWB will be issued with pick-up from the third party. For the thirdParty, the buyer's data will be sent, and for the recipient, the customer's data (where the package will be delivered) will be sent 

It will be necessary to send the date by which the buyer can load the package into the locker (eligibilityDate). If the buyer does not load the return into the locker by that date, we will automatically cancel the order. It will be marked with the status Canceled locker order - reason Expiry date 

- It would be ideal to send the dimensions of the package in order to be able to calculate the type of box that we will open for the customer when it arrives at easybox. If the dimensions cannot be sent, we will set the default box S. If the packaged product will be 

larger than the calculated box type, they will have the option to request a larger box. If it does not fit even in the largest box, the buyer will be able to cancel the order. It will be marked with the status Order canceled locker – reason Canceled by sender at locker 

- When creating the AWB we will return the charge code (lockerReturnChargeCode) in response. You will need to have a flow through which you can send the return code to the customer, via email or SMS. 

## **Extra service options** 

Extra service options are complementary to the transport services and can be added on request. 

The most common extra options are the following: 

- Parcel opening (OPCG) 

- Exchange parce (SWAP) 

- Document return (RDOC) 

- Personal delivery at a fixed point (PDO) 

- It is not possible to add or assign extra options for the client through the WebService. 

## **If the desired extra options are not visible on your account, please contact the Sameday commercial department.** 

List of extra options: 

- It is a GET type request 

- The URL is api/client/services; 

- The X-AUTH-TOKEN header will be sent 

In response, all services and extra options active on the account will be displayed. Extra options for transport services are displayed in the serviceOptionalTaxes parameter. Select the appropriate value depending on the package type in the request (packageType: 0, 1 or 2). 

The values  in the field - serviceOptionalTaxes "id" - are unique for each customer account. When implementing the desired extra option, use the ids returned by the API response. 

## **Counties/provinces, cities and localities** 

To avoid possible sorting errors, it is recommended to map the Sameday county and locality nomenclature with the client's nomenclature, and when creating an AWB to send the Sameday county ID and locality ID. 

The Sameday system allows the following variants: 

The locality ID from the Sameday system - in which case the shipment will enter the operational flow directly 

The name of the locality - for which an automatic mapping will be attempted based on some text dictionaries with the localities in the Sameday nomenclature; if this process fails, the shipment will enter a manual review process and Sameday operators will map the name sent with a locality from the nomenclature 

It is recommended to contact the Sameday support team if you notice inconsistencies in the nomenclature of counties/localities. 

List of counties: It is a GET request The url is **api/geolocation/county** The X-AUTH-TOKEN header will be sent 

In the sandbox environment, the request will look similar to: 

The answer will be similar to the one in the image below, and the id and name details are relevant. 

List of localities: 

It is a GET request 

The url is **api/geolocation/city** 

The X-AUTH-TOKEN header will be sent 

In the sandbox environment, the request will look similar to: 

Name, county, postalCode, page, countPerPage filters can also be applied, examples: 

name: Sector (and all cities containing the substring 'sector' will be returned) county: Bucuresti (and all the cities associated with Bucuresti county will be returned) postalCode: 032 (and all cities with a postal code containing 032 will be returned) 

The answer will be similar to the one in the image below, and the id and name details are relevant. 

## **The status of a shipment** 

To find out the current status of a shipment, Sameday provides several endpoints, depending on the needs of each customer. 

## **URL tracking** 

The first option is by adding a tracking link to the Sameday website. 

The URL is of the form https://sameday.ro/#awb=   where after the equal sign, the AWB number of the shipment will be filled. 

## **API retrieval for each AWB** 

If you are generating AWBs for your local market (examples: RO-RO, HU-HU, BG-BG), use _**GET**_ **/api/client/status-sync** 

If you are generating AWBs from your local market and delivery crossborder (delivery to another country: examples: RO-HU, HU-RO, etc), use _**GET**_ **/api/client/xb-status-sync** 

- It is a GET request 

- Returns the status transitions which took place between 2 timestamps for the current client. * The maximum interval between the 2 timestamps is 2 hours. The results will be paginated 

- The X-AUTH-TOKEN header will be sent 

In the sandbox environment, the request will look similar to: 

The answer will be similar to the one in the image below: 

## **Downloading the easybox locker list** 

The endpoint through which the easybox locker list can be retrieved are **GET/api/client/lockers** or **GET/api/client/ooh-locations.** 

Please note that **GET/api/client/lockers** will be deprecated. Please implement **GET/api/client/ooh-locations** . 

> e It is a GET request. 

> e The X-AUTH-TOKEN header will be sent. 

In the sandbox environment, the request will look similar to: 

The response will be paginated and will look similar to the one below, where the total number of lockers, the number of pages will be returned. By default, 500 lockers per page will be returned. 

Only the available locations will be displayed. If a location was deactivated, it will not be displayed by the endpoint. 

`1 { 2 "total": 4918, 3 "currentPage": 1, 4 "pages": 4918, 5 "perPage": 1, 6 "data": [ 7 { 8 "name": "easybox OMV Belu", 9 "country": "Romania", 10 "countryId": 187, 11 "county": "Bucuresti", 12 "countyId": 1, 13 "city": "Sectorul 4", 14 "cityId": 4, 15 "address": "Sos. Oltenitei, Nr. 2", 16 "postalCode": "044501", 17 "lat": 44.402018, 18 "lng": 26.097853, 19 "oohId": 2, 20 "oohType": 0, 21 "supportedPayment": 1, 22 "clientVisible": 1, 23 "deliveryLogisticLocationId": 354,` 

**==> picture [258 x 704] intentionally omitted <==**

**----- Start of picture text -----**<br>
|||
|---|---|
|24|"deliveryLogisticLocation": "B_SEMA_LN_A12",|
|25|"occupancyLevel": 1,|
|26|"email": null,|
|27|"phone": null,|
|28|"oohRoute": "BA12-R45",|
|29|"schedule": [|
|30|{|
|31|"day": 1,|
|32|"openingHour": "00:00",|
|33|"closingHour": "23:59"|
|34|},|
|35|{|
|36|"day": 2,|
|37|"openingHour": "00:00",|
|38|"closingHour": "23:59"|
|39|},|
|40|{|
|41|"day": 3,|
|42|"openingHour": "00:00",|
|43|"closingHour": "23:59"|
|44|},|
|45|{|
|46|"day": 4,|
|47|"openingHour": "00:00",|
|48|"closingHour": "23:59"|
|49|},|
|50|{|
|51|"day": 5,|
|52|"openingHour": "00:00",|
|53|"closingHour": "23:59"|
|54|},|
|55|{|
|56|"day": 6,|
|57|"openingHour": "00:00",|
|58|"closingHour": "23:59"|
|59|},|
|60|{|
|61|"day": 7,|
|62|"openingHour": "00:00",|
|63|"closingHour": "23:59"|
|64|}|
|65|],|
|66|"specialSchedule": [],|
|67|"photos": [|
|68|{|
|69|"1x": "/locker/image/17037/1x",|
|70|"2x": "/locker/image/17037/2x",|
|71|"small": "/locker/image/17037/small"|
|72|},|
|73|{|
|74|"1x": "/locker/image/17038/1x",|
|75|"2x": "/locker/image/17038/2x",|
|76|"small": "/locker/image/17038/small"|
|77|}|
|78|]|
|79|}|
|80|]|
|81|}|

**----- End of picture text -----**<br>


## **Show map of easybox lockers** 

## **Locker PlugIn SDK (React) - Javascript** 

By installing and using the SDK developed by Sameday, you will reduce both the development time of your own solution on your site, as well as the costs of this development. 

The main functionalities developed in the plugin are: 

Filter lockers by the following criteria: County, Easybox Name 

Example: search for Sectorul 1 - Bucuresti 

Displaying lockers based on user location and zoom in / zoom out option, day mode / night mode 

Example: zoomed in, dark mode 

Example: zoomed in map, light mode 

The banner "Congested delivery point. Delivery in x days" represents an estimate of delivery to the respective Easybox. 

To display all the details, click on the desired Easybox. You will be shown the Easybox address, working hours, delivery estimate, and the cash on delivery payment options available at Easybox (card payment). 

Installation steps are available at https://cdn.sameday.ro/locker-plugin/techdoc.html 

Dupa instalarea SDK-ului, va rugam sa transmiteti catre echipa de suport tehnic domeniile (test si productie), pentru a genera si furniza clientId-ul necesar initializarii hartii. 

## **API call examples** 

**Create AWB with same country delivery (ex: RO to RO), containing one parcel - home delivery (24H)** 

- `1 {` 

- `2 "packageType":"0", // => 0= standard parcel; 1=small parcel (example: envelope); 2=big parcel (example: freezer)` 

- `3 "insuredValue":"699.9900",` 

- `4 "cashOnDelivery":"427.9700",` 

- `5 "observation":"observation 1",` 

- `6 "priceObservation":"observation 2",` 

- `7 "clientObservation":"observation 3",` 

- `8 "awbPayment":"1", // => the company who generates the AWB shipment` 

- `9 "thirdPartyPickup":"0",` 

- `10 "pickupPoint":"123", // => represents your warehouse/store id from where the sameday courier will load the parcels` 

- `11 You can obtain the ID by calling this endpoint get--api-client-pickup-points` 

- `12` 

- `13 "service":"7", // => 7 is the ID for the home delivery service (24H Nextday delivery).` 

- `14 For other services, call this endpoint get—api-client-services` 

- `15` 

- `16 "contactPerson":"1", // => the warehouse/store contact person ID.` 

- `17 You can obtain the ID by calling this endpoint get--api-client-pickup-points` 

- `18 "awbRecipient":{` 

- `19 "county":"1",  // => for the complete list of provinces/countys use: get--api-geolocation-county` 

- `20 "city":"6", // => for the complete list of cities use: get--api-geolocation-city 21 "address":"Test address", // => fill it using the street name and house number` 

`22 "name":"Test name", // => your customer full name 23 "phoneNumber":"0700000000", // => your customer phone number 24 "postalCode":"060011", 25 "personType":"0" // => 0= natural person ; 1= company 26 }, 27 "packageWeight":"1", 28 "parcels":[ 29 { 30 "weight":"3.8", 31 "width":"46.6", 32 "length":"73.7", 33 "height":"15.1" 34 } 35 ], 36 "packageNumber":"1", // => number of packages 37 "clientInternalReference":"client_unique_reference", // => must always be unique, 38 39 } 40 41 42` 

**Create AWB with same country delivery (ex: RO to RO), containing two parcels - home delivery (24H)** 

`1 { 2 "packageType":"0", 3 "insuredValue":"699.9900", 4 "cashOnDelivery":"427.9700", 5 "observation":"observation 1", 6 "priceObservation":"observation 2", 7 "clientObservation":"observation 3", 8 "awbPayment":"1", 9 "thirdPartyPickup":"0", 10 "pickupPoint":"1", 11 "service":"7", 12 "contactPerson":"1", 13 "awbRecipient":{ 14 "county":"1", 15 "city":"6", 16 "address":"Test address", 17 "name":"Test name", 18 "phoneNumber":"0700000000", 19 "postalCode":"060011", 20 "personType":"0" 21 }, 22 "packageWeight":"7.6", 23 "parcels":[ 24 { 25 "weight":"3.8", 26 "width":"46.6", 27 "length":"73.7", 28 "height":"15.1" 29 }, 30 { 31 "weight":"3.8", 32 "width":"46.6", 33 "length":"73.7", 34 "height":"15.1" 35 },` 

`36` 

`37 ],` 

`38 "packageNumber":"2",` 

`39 "clientInternalReference":"client_unique_reference", 40 }` 

## **Local return shipping with home pickup (Standard Return)** 

- `1 {` 

- `2 "packageType":"0", 3 "insuredValue":"699.9900", 4 "cashOnDelivery":"427.9700", 5 "observation":"observation 1",` 

- `6 "priceObservation":"observation 2",` 

- `7 "clientObservation":"observation 3",` 

`8 "awbPayment":"1", 9 "thirdPartyPickup":"1", 10 "thirdParty":{ 11 "county":1, 12 "city":1, 13 "address":"test pickup address", 14 "personType":0, 15 "phoneNumber":"0700000000", 16 "name":" test name " 17 }, 18 "pickupPoint":"123",` 

`19` 

- `20 "service":"10", // => 10 is the  ID for the Standard Return service.` 

`21 For other services, please use: get—api-client-services` 

`22` 

- `23 "contactPerson":"1", // => get the ID by using: get--api-client-pickup-points` 

- `24 "awbRecipient":{` 

- `25 "county":"1",  // => for the full county/province list, use: get--api-geolocation-county` 

- `26 "city":"6", // => for the full city list, use: get--api-geolocation-city` 

`27 "address":"client warehouse address", 28 "name":"client name", 29 "phoneNumber":"0700000000", 30 "postalCode":"060011", 31 "personType":"0" 32 }, 33 "packageWeight":"1", 34 "parcels":[ 35 { 36 "weight":"3.8", 37 "width":"46.6", 38 "length":"73.7", 39 "height":"15.1" 40 } 41 ], 42 "packageNumber":"1", 43 "clientInternalReference":"client_unique_reference", 44 } 45 46 47` 

**Local parcel exchange shipping (SWAP)** 

`1 {` 

- `2 "pickupPoint":"1", // => to get your ID, use get--api-client-pickup-points` 

- `3 "contactPerson":"1", // => to get your ID, use  get--api-client-pickup-points` 

- `4 "packageType":"0",` 

- `5 "packageNumber":"1",` 

- `6 "packageWeight":"1",` 

- `7 "service":"7",` 

- `8 "awbPayment":"1",` 

- `9 "cashOnDelivery":"7.31",` 

- `10 "insuredValue":"0",` 

- `11 "thirdPartyPickup":"0", 12 "serviceTaxes":[ 13 "SWAP" // => SWAP is the code for the exchange parcel` 

`14 ], 15 "awbRecipient":{ 16 "county":"1",  // => to get your ID, use  get--api-geolocation-county 17 "city":"6", // => to get your ID, use  get--api-geolocation-city 18 "address":"client warehouse address", 19 "name":"client name", 20 "phoneNumber":"0700000000", 21 "postalCode":"060011", 22 "personType":"0" 23 }, 24 "parcels":[ 25 { 26 "weight":"1", 27 "width":"1", 28 "length":"1", 29 "height":"1" 30 } 31 ] 32 }` 

## Reply: 

`1 { 2 "awbNumber":"1SDY241120277", // => delivery awb number 3 "awbCost":9.55, 4 "parcels":[ 5 { 6 "position":1, 7 "awbNumber":"1SDY241120277001" , // => delivery parcel number 8 } 9 ], 10 "pdfLink":"https:\/\/api.sameday.ro\/api\/awb\/download\/1SDY241120277", 11 "pickupLogisticLocation":"B_MOGOSOAIA_A01", 12 "deliveryLogisticLocation":"B_MOGOSOAIA_A01", 13 "deliveryLogisticCircle":"Cerc 1", 14 "returnAwbs":[ 15 { 16 "awbNumber":"1SDYCS1120277", // => return AWB number 17 "awbCost":12.65, 18 "serviceTaxId":11 19 } 20 ], 21 "sortingHub":"B_HUB_H01", 22 "sortingHubId":4, 23 "deliveryLogisticLocationId":1, 24 "pickupLogisticLocationId":1` 

`25 }` 

## **Local Easybox delivery request (Locker Nextday)** 

- `1 {` 

`2 "packageType":"0", 3 "insuredValue":"699.9900", 4 "cashOnDelivery":"427.9700", 5 "observation":"observation 1", 6 "priceObservation":"observation 2", 7 "clientObservation":"observation 3", 8 "awbPayment":"1", 9 "thirdPartyPickup":"0", 10 "pickupPoint":"1", 11 "service":"15", // => 15 is the service for Easybox delivery 12 "contactPerson":"1", 13 "awbRecipient":{ 14 "name":"Test name", 15 "phoneNumber":"0700000000", 16 "personType":"0" 17 "email":"recipient.email@email.com" 18 }, 19 "packageWeight":"1", 20 "parcels":[ 21 { 22 "weight":"3.8", 23 "width":"46.6", 24 "length":"73.7", 25 "height":"15.1" 26 } 27 ], 28 "packageNumber":"1", 29 "clientInternalReference":"client_unique_reference", 30 "oohLastMile":"174",  => here you will put the Easybox ID. In order to obtain those IDs, call GET/api/client/ooh-locations` 

`31 32 } 33 34 35` 

## **Local shipping with personal loading (PDO) in Easybox and delivery to an Easybox (Locker Nextday)** 

In the serviceTaxes parameter, add both the PDO code and the ID of this extra option. Use only the IDcorresponding to the package type in the request (packageType: 0, 1 or 2). 

These IDs are unique for each Sameday customer. 

- `1 {` 

- `2 "packageType":"0",` 

- `3 "insuredValue":"699.9900",` 

- `4 "cashOnDelivery":"427.9700",` 

- `5 "observation":"observation 1",` 

- `6 "priceObservation":"observation 2",` 

- `7 "clientObservation":"observation 3",` 

`8 "awbPayment":"1",` 

`9 "thirdPartyPickup":"0", 10 "pickupPoint":"1",` 

`11 "service":"15", // => 15 is the service for Easybox delivery` 

`12` 

`13 "serviceTaxes":"PDO 123456", 14 PDO is the code for Personal Dropoff + the unique ID alocated to the packageType 15 To obtain the IDs, call GET/API/CLIENT/SERVICES endpoit. 16 17 "contactPerson":"1", 18 "awbRecipient":{ 19 "name":"Test name", 20 "phoneNumber":"0700000000", 21 "personType":"0" 22 "email":"recipient.email@email.com" 23 }, 24 "packageWeight":"1", 25 "parcels":[ 26 { 27 "weight":"3.8", 28 "width":"46.6", 29 "length":"73.7", 30 "height":"15.1" 31 } 32 ], 33 "packageNumber":"1", 34 "clientInternalReference":"client_unique_reference", 35 36 "oohLastMile":"174", 37 => ID for the delivery locker 38 }` 

## **Local return shipping, with delivery in easybox (Return in locker)** 

Please note that the lockerFirstMile and lockerLastMile parameters will be deprecated in 2025 (exact date TBA). They are being replaced with oohFirstMile and oohLastMile. 

Please implement them in all your integrations! 

`1 {` 

`2 "pickupPoint":"139", 3 "contactPerson":"145", 4 "packageType":"0", 5 "packageNumber":"1", 6 "packageWeight":"1", 7 "service":"24", => 24 is the ID for Easybox return service (Return in locker) 8 "awbPayment":"1", 9 "cashOnDelivery":"0", 10 "insuredValue":"0", 11 "thirdPartyPickup":"1", 12 "thirdParty":{ 13 "name":"Client Name", 14 "phoneNumber":"0700000000", 15 "email":"client.email@email.com" 16 "personType":"0", 17 }, 18 "awbRecipient":{ 19 "name":"Nume", 20 "phoneNumber":"07222", 21 "personType":"1", 22 "companyName":"Numele companiei dvs.", 23 "address":"Splaiul Independentei",` 

`24 "county":"11", 25 "city":"23", 26 }, 27 "parcels":[ 28 "1", 29 { 30 "weight":"1" 31 } 32 ], 33 "oohFirstMile":"264", => The locker ID where the package will be returned. 34 35 36 "returnLockerParcel":{ 37 "eligibilityDate":"2023-01-15 23:59:59" 38 } 39 }` 

## **International shipping with home delivery (Crossborder HD 24H)** 

`1 { 2 "packageType":"0", 3 "insuredValue":"0", 4 "cashOnDelivery":"427.9700", 5 "currency":"HUF" 6 "observation":"observation 1", 7 "priceObservation":"observation 2", 8 "clientObservation":"observation 3", 9 "awbPayment":"1", 10 "thirdPartyPickup":"0", 11 "pickupPoint":"1", 12 "service":"28", // => 28 is the ID for Crossborder HD 24H service. 13 "contactPerson":"1", 14 "awbRecipient":{ 15 "county":"62", // => county ID from the destination country 16 "city":"16146", // => city ID from the destination country 17 "address":"Test address", 18 "name":"Test name", 19 "phoneNumber":"0700000000", 20 "postalCode":"1100", 21 "personType":"0" 22 }, 23 "packageWeight":"1", 24 "parcels":[ 25 { 26 "weight":"3.8", 27 "width":"46.6", 28 "length":"73.7", 29 "height":"15.1" 30 } 31 ], 32 "packageNumber":"1", 33 "clientInternalReference":"client_unique_reference", 34 } 35 36 37` 

**International return shipping with home pickup (Crossborder Standard Return)** 

`1 {` 

`2 "packageType":"0", 3 "insuredValue":"699.9900", 4 "observation":"observation 1", 5 "priceObservation":"observation 2", 6 "clientObservation":"observation 3", 7 "awbPayment":"1", 8 "thirdPartyPickup":"1", 9 "thirdParty":{ 10 "county":62, 11 "city":16146, 12 "address":"test pickup address", 13 "postalCode":"1100", 14 "personType":0, 15 "phoneNumber":"0700000000", 16 "name":" test name " 17 }, 18 "pickupPoint":"1",` 

`19` 

`20 "service":"29", // => 29 is the ID for Crossborder Standard Return service 21 22` 

`23 "contactPerson":"1", 24 "awbRecipient":{ 25 "county":"1", 26 "city":"6", 27 "address":"client warehouse address", 28 "name":"client name", 29 "phoneNumber":"0700000000", 30 "postalCode":"060011", 31 "personType":"0" 32 }, 33 "packageWeight":"1", 34 "parcels":[ 35 { 36 "weight":"3.8", 37 "width":"46.6", 38 "length":"73.7", 39 "height":"15.1" 40 } 41 ], 42 "packageNumber":"1", 43 "clientInternalReference":"client_unique_reference", 44 } 45 46 47` 

**International shipping with easybox delivery (Crossborder Locker delivery)** 

- `1 {` 

`2 "packageType":"0", 3 "insuredValue":"0", 4 "cashOnDelivery":"427.9700", 5 "currency":"HUF" 6 "observation":"observation 1", 7 "priceObservation":"observation 2", 8 "clientObservation":"observation 3",` 

`9 "awbPayment":"1", 10 "thirdPartyPickup":"0", 11 "pickupPoint":"1", 12 "service":"30", // => 30 is the ID for Crossborder Locker delivery 13 "contactPerson":"1", 14 "awbRecipient":{ 15 "name":"Test name", 16 "phoneNumber":"0700000000", 17 "personType":"0" 18 "email":"recipient.email@email.com" 19 }, 20 "packageWeight":"1", 21 "parcels":[ 22 { 23 "weight":"3.8", 24 "width":"46.6", 25 "length":"73.7", 26 "height":"15.1" 27 } 28 ], 29 "packageNumber":"1", 30 "clientInternalReference":"client_unique_reference", 31 32 "oohLastMile":"10001", 33 } 34 35 36` 

## **International return shipping, with delivery in easybox (Crossborder Locker return)** 

`1 { 2 "pickupPoint":"1", 3 "contactPerson":"1", 4 "packageType":"0", 5 "packageNumber":"1", 6 "packageWeight":"1", 7 "service":"31", => 31 is the ID for Crossborder Locker return 8 "awbPayment":"1", 9 "cashOnDelivery":"0", 10 "insuredValue":"0", 11 "thirdPartyPickup":"1", 12 "thirdParty":{ 13 "name":"Client Name", 14 "phoneNumber":"0700000000", 15 "email":"client.email@email.com" 16 "personType":"0", 17 }, 18 "awbRecipient":{ 19 "name":"Nume", 20 "phoneNumber":"07222", 21 "personType":"1", 22 "companyName":"Numele companiei dvs.", 23 "address":"Splaiul Independentei", 24 "county":"11", 25 "city":"23", 26 }, 27 "parcels":[ 28 "1",` 

`29 { 30 "weight":"1" 31 } 32 ], 33 "oohFirstMile":"10001", 34 35 "returnLockerParcel":{ 36 "eligibilityDate":"2023-01-15 23:59:59" 37 } 38 } 39 40 41` 

## **National shipping, fixed point shipping (PUDO Nextday)** 

- `1 {` 

`2 "pickupPoint":"1", 3 "contactPerson":"1", 4 "packageType":"1", 5 "packageNumber":"1", 6 "packageWeight":"1", 7 "service":"57", => 57 is the ID for PUDO Nextday 8 "awbPayment":"1", 9 "cashOnDelivery":"0", 10 "insuredValue":"0", 11 "thirdPartyPickup":"0", 12 "awbRecipient":{ 13 "name":"Client Name", 14 "phoneNumber":"0700000000", 15 "email":"client.email@email.com" 16 "personType":"0", 17 }, 18 19 "parcels":[ 20 "1", 21 { 22 "weight":"1", 23 "width":"1", 24 "length":"1", 25 "height":"1" 26 } 27 ], 28 29 "oohLastMile":"500100", 30 31 } 32 33 34` 

