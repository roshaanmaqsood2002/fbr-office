export interface Scenario {
  id: string;
  description: string;
  saleType: string;
}

// From the DI API spec v1.12, section 9. Sale types must match FBR's transaction-type reference list exactly.
export const SCENARIOS: Scenario[] = [
  {
    id: "SN001",
    description: "Goods at standard rate to registered buyers",
    saleType: "Goods at standard rate (default)",
  },
  {
    id: "SN002",
    description: "Goods at standard rate to unregistered buyers",
    saleType: "Goods at standard rate (default)",
  },
  {
    id: "SN003",
    description: "Sale of steel (melted and re-rolled)",
    saleType: "Steel Melting and re-rolling",
  },
  {
    id: "SN004",
    description: "Sale by ship breakers",
    saleType: "Ship breaking",
  },
  {
    id: "SN005",
    description: "Reduced rate sale",
    saleType: "Goods at Reduced Rate",
  },
  { id: "SN006", description: "Exempt goods sale", saleType: "Exempt Goods" },
  {
    id: "SN007",
    description: "Zero rated sale",
    saleType: "Goods at zero-rate",
  },
  {
    id: "SN008",
    description: "Sale of 3rd schedule goods",
    saleType: "3rd Schedule Goods",
  },
  {
    id: "SN009",
    description: "Cotton spinners purchase from cotton ginners",
    saleType: "Cotton Ginners",
  },
  {
    id: "SN010",
    description: "Telecom services rendered or provided",
    saleType: "Telecommunication services",
  },
  {
    id: "SN011",
    description: "Toll manufacturing sale by steel sector",
    saleType: "Toll Manufacturing",
  },
  {
    id: "SN012",
    description: "Sale of petroleum products",
    saleType: "Petroleum Products",
  },
  {
    id: "SN013",
    description: "Electricity supply to retailers",
    saleType: "Electricity Supply to Retailers",
  },
  {
    id: "SN014",
    description: "Sale of gas to CNG stations",
    saleType: "Gas to CNG stations",
  },
  {
    id: "SN015",
    description: "Sale of mobile phones",
    saleType: "Mobile Phones",
  },
  {
    id: "SN016",
    description: "Processing / conversion of goods",
    saleType: "Processing/ Conversion of Goods",
  },
  {
    id: "SN017",
    description: "Sale of goods where FED is charged in ST mode",
    saleType: "Goods (FED in ST Mode)",
  },
  {
    id: "SN018",
    description: "Services where FED is charged in ST mode",
    saleType: "Services (FED in ST Mode)",
  },
  {
    id: "SN019",
    description: "Services rendered or provided",
    saleType: "Services",
  },
  {
    id: "SN020",
    description: "Sale of electric vehicles",
    saleType: "Electric Vehicle",
  },
  {
    id: "SN021",
    description: "Sale of cement / concrete block",
    saleType: "Cement /Concrete Block",
  },
  {
    id: "SN022",
    description: "Sale of potassium chlorate",
    saleType: "Potassium Chlorate",
  },
  { id: "SN023", description: "Sale of CNG", saleType: "CNG Sales" },
  {
    id: "SN024",
    description: "Goods listed in SRO 297(1)/2023",
    saleType: "Goods as per SRO.297(|)/2023",
  },
  {
    id: "SN025",
    description: "Drugs at fixed ST rate (Eighth Schedule, serial 81)",
    saleType: "Non-Adjustable Supplies",
  },
  {
    id: "SN026",
    description: "Sale to end consumer by retailers (standard rate)",
    saleType: "Goods at standard rate (default)",
  },
  {
    id: "SN027",
    description: "Sale to end consumer by retailers (3rd schedule)",
    saleType: "3rd Schedule Goods",
  },
  {
    id: "SN028",
    description: "Sale to end consumer by retailers (reduced rate)",
    saleType: "Goods at Reduced Rate",
  },
];

export const DEFAULT_SALE_TYPE = "Goods at standard rate (default)";
export const SALE_TYPES = Array.from(
  new Set(SCENARIOS.map((s) => s.saleType)),
) as [string, ...string[]];

// Confirm the exact strings against FBR's province reference API (GET /pdi/v1/provinces) during sandbox testing
export const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Azad Jammu and Kashmir",
  "Gilgit Baltistan",
];

export const canonicalProvince = (p?: string | null) =>
  PROVINCES.find((x) => x.toLowerCase() === (p ?? "").trim().toLowerCase()) ??
  (p ?? "").trim();

// FBR needs units from its own list (e.g. "Numbers, pieces, units", "KG"). Common spellings are mapped here;
// anything else is sent as typed and FBR will tell you (error 0099) which unit it expects.
const UOM_ALIASES: Record<string, string> = {
  unit: "Numbers, pieces, units",
  units: "Numbers, pieces, units",
  piece: "Numbers, pieces, units",
  pieces: "Numbers, pieces, units",
  pcs: "Numbers, pieces, units",
  pc: "Numbers, pieces, units",
  number: "Numbers, pieces, units",
  numbers: "Numbers, pieces, units",
  nos: "Numbers, pieces, units",
  each: "Numbers, pieces, units",
  kg: "KG",
  kgs: "KG",
  kilogram: "KG",
  kilograms: "KG",
};
export const normalizeUom = (u: string) =>
  UOM_ALIASES[u.trim().toLowerCase()] ?? u.trim();
