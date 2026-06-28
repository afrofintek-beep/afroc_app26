import { Language } from "@/contexts/LanguageContext";

export interface CountryConfig {
  code: string;
  name: string;
  nameKey: string; // translation key
  language: Language;
  center: [number, number]; // [longitude, latitude]
  zoom: number;
}

export const COUNTRIES: CountryConfig[] = [
  {
    code: "DZ",
    name: "Algérie",
    nameKey: "country_algeria",
    language: "ar",
    center: [1.6596, 28.0339],
    zoom: 5
  },
  {
    code: "AO",
    name: "Angola",
    nameKey: "country_angola",
    language: "pt",
    center: [17.8739, -11.2027],
    zoom: 5.5
  },
  {
    code: "BJ",
    name: "Bénin",
    nameKey: "country_benin",
    language: "fr",
    center: [2.3158, 9.3077],
    zoom: 6.5
  },
  {
    code: "BW",
    name: "Botswana",
    nameKey: "country_botswana",
    language: "en",
    center: [24.6849, -22.3285],
    zoom: 6
  },
  {
    code: "BF",
    name: "Burkina Faso",
    nameKey: "country_burkina_faso",
    language: "fr",
    center: [-1.5616, 12.2383],
    zoom: 6
  },
  {
    code: "BI",
    name: "Burundi",
    nameKey: "country_burundi",
    language: "fr",
    center: [29.9189, -3.3731],
    zoom: 8
  },
  {
    code: "CV",
    name: "Cabo Verde",
    nameKey: "country_cape_verde",
    language: "pt",
    center: [-23.6052, 16.5388],
    zoom: 7
  },
  {
    code: "CM",
    name: "Cameroun",
    nameKey: "country_cameroon",
    language: "fr",
    center: [12.3547, 7.3697],
    zoom: 6
  },
  {
    code: "CF",
    name: "Centrafrique",
    nameKey: "country_central_african_republic",
    language: "fr",
    center: [20.9394, 6.6111],
    zoom: 6
  },
  {
    code: "KM",
    name: "Comores",
    nameKey: "country_comoros",
    language: "fr",
    center: [43.8722, -11.8750],
    zoom: 8.5
  },
  {
    code: "CG",
    name: "Congo",
    nameKey: "country_congo",
    language: "fr",
    center: [15.8277, -0.2280],
    zoom: 6
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    nameKey: "country_ivory_coast",
    language: "fr",
    center: [-5.5471, 7.5400],
    zoom: 6.5
  },
  {
    code: "DJ",
    name: "Djibouti",
    nameKey: "country_djibouti",
    language: "fr",
    center: [42.5903, 11.8251],
    zoom: 7.5
  },
  {
    code: "EG",
    name: "Egypt",
    nameKey: "country_egypt",
    language: "ar",
    center: [30.8025, 26.8206],
    zoom: 5.5
  },
  {
    code: "ER",
    name: "Eritrea",
    nameKey: "country_eritrea",
    language: "ar",
    center: [39.7823, 15.1794],
    zoom: 6.5
  },
  {
    code: "SZ",
    name: "Eswatini",
    nameKey: "country_eswatini",
    language: "en",
    center: [31.4659, -26.5225],
    zoom: 8
  },
  {
    code: "ET",
    name: "Ethiopia",
    nameKey: "country_ethiopia",
    language: "am",
    center: [40.4897, 9.1450],
    zoom: 5.5
  },
  {
    code: "GA",
    name: "Gabon",
    nameKey: "country_gabon",
    language: "fr",
    center: [11.6094, -0.8037],
    zoom: 6.5
  },
  {
    code: "GM",
    name: "Gambia",
    nameKey: "country_gambia",
    language: "en",
    center: [-15.3101, 13.4432],
    zoom: 7.5
  },
  {
    code: "GH",
    name: "Ghana",
    nameKey: "country_ghana",
    language: "en",
    center: [-1.0232, 7.9465],
    zoom: 6.5
  },
  {
    code: "GN",
    name: "Guinée",
    nameKey: "country_guinea",
    language: "fr",
    center: [-9.6966, 9.9456],
    zoom: 6.5
  },
  {
    code: "GQ",
    name: "Guinée Équatoriale",
    nameKey: "country_equatorial_guinea",
    language: "pt",
    center: [10.2679, 1.6508],
    zoom: 7
  },
  {
    code: "GW",
    name: "Guiné-Bissau",
    nameKey: "country_guinea_bissau",
    language: "pt",
    center: [-15.1804, 11.8037],
    zoom: 7
  },
  {
    code: "KE",
    name: "Kenya",
    nameKey: "country_kenya",
    language: "sw",
    center: [37.9062, -0.0236],
    zoom: 6
  },
  {
    code: "LS",
    name: "Lesotho",
    nameKey: "country_lesotho",
    language: "en",
    center: [28.2336, -29.6100],
    zoom: 8
  },
  {
    code: "LR",
    name: "Liberia",
    nameKey: "country_liberia",
    language: "en",
    center: [-9.4295, 6.4281],
    zoom: 7
  },
  {
    code: "LY",
    name: "Libya",
    nameKey: "country_libya",
    language: "ar",
    center: [17.2283, 26.3351],
    zoom: 5
  },
  {
    code: "MG",
    name: "Madagascar",
    nameKey: "country_madagascar",
    language: "fr",
    center: [46.8691, -18.7669],
    zoom: 5.5
  },
  {
    code: "MW",
    name: "Malawi",
    nameKey: "country_malawi",
    language: "en",
    center: [34.3015, -13.2543],
    zoom: 6.5
  },
  {
    code: "ML",
    name: "Mali",
    nameKey: "country_mali",
    language: "fr",
    center: [-3.9962, 17.5707],
    zoom: 5.5
  },
  {
    code: "MA",
    name: "Maroc",
    nameKey: "country_morocco",
    language: "ar",
    center: [-7.0926, 31.7917],
    zoom: 5.5
  },
  {
    code: "MU",
    name: "Maurice",
    nameKey: "country_mauritius",
    language: "en",
    center: [57.5522, -20.3484],
    zoom: 9
  },
  {
    code: "MR",
    name: "Mauritanie",
    nameKey: "country_mauritania",
    language: "ar",
    center: [-10.9408, 21.0079],
    zoom: 5.5
  },
  {
    code: "MZ",
    name: "Moçambique",
    nameKey: "country_mozambique",
    language: "pt",
    center: [35.5296, -18.6657],
    zoom: 5.5
  },
  {
    code: "NA",
    name: "Namibia",
    nameKey: "country_namibia",
    language: "en",
    center: [18.4904, -22.9576],
    zoom: 5.5
  },
  {
    code: "NE",
    name: "Niger",
    nameKey: "country_niger",
    language: "fr",
    center: [8.0817, 17.6078],
    zoom: 5.5
  },
  {
    code: "NG",
    name: "Nigeria",
    nameKey: "country_nigeria",
    language: "en",
    center: [8.6753, 9.0820],
    zoom: 6
  },
  {
    code: "CD",
    name: "RD Congo",
    nameKey: "country_dr_congo",
    language: "fr",
    center: [21.7587, -4.0383],
    zoom: 5
  },
  {
    code: "RW",
    name: "Rwanda",
    nameKey: "country_rwanda",
    language: "fr",
    center: [29.8739, -1.9403],
    zoom: 8
  },
  {
    code: "ST",
    name: "São Tomé e Príncipe",
    nameKey: "country_sao_tome",
    language: "pt",
    center: [6.6131, 0.1864],
    zoom: 8
  },
  {
    code: "SN",
    name: "Sénégal",
    nameKey: "country_senegal",
    language: "fr",
    center: [-14.4524, 14.4974],
    zoom: 7
  },
  {
    code: "SC",
    name: "Seychelles",
    nameKey: "country_seychelles",
    language: "en",
    center: [55.4920, -4.6796],
    zoom: 9
  },
  {
    code: "SL",
    name: "Sierra Leone",
    nameKey: "country_sierra_leone",
    language: "en",
    center: [-11.7799, 8.4606],
    zoom: 7
  },
  {
    code: "SO",
    name: "Somalia",
    nameKey: "country_somalia",
    language: "ar",
    center: [46.1996, 5.1521],
    zoom: 6
  },
  {
    code: "ZA",
    name: "South Africa",
    nameKey: "country_south_africa",
    language: "en",
    center: [22.9375, -30.5595],
    zoom: 5.5
  },
  {
    code: "SS",
    name: "South Sudan",
    nameKey: "country_south_sudan",
    language: "en",
    center: [31.3070, 6.8770],
    zoom: 6
  },
  {
    code: "SD",
    name: "Sudan",
    nameKey: "country_sudan",
    language: "ar",
    center: [30.2176, 12.8628],
    zoom: 5
  },
  {
    code: "TZ",
    name: "Tanzania",
    nameKey: "country_tanzania",
    language: "sw",
    center: [34.8888, -6.3690],
    zoom: 5.5
  },
  {
    code: "TD",
    name: "Tchad",
    nameKey: "country_chad",
    language: "fr",
    center: [18.7322, 15.4542],
    zoom: 5.5
  },
  {
    code: "TG",
    name: "Togo",
    nameKey: "country_togo",
    language: "fr",
    center: [0.8248, 8.6195],
    zoom: 7
  },
  {
    code: "TN",
    name: "Tunisia",
    nameKey: "country_tunisia",
    language: "ar",
    center: [9.5375, 33.8869],
    zoom: 6
  },
  {
    code: "UG",
    name: "Uganda",
    nameKey: "country_uganda",
    language: "en",
    center: [32.2903, 1.3733],
    zoom: 7
  },
  {
    code: "ZM",
    name: "Zambia",
    nameKey: "country_zambia",
    language: "en",
    center: [27.8493, -13.1339],
    zoom: 6
  },
  {
    code: "ZW",
    name: "Zimbabwe",
    nameKey: "country_zimbabwe",
    language: "sn",
    center: [29.1549, -19.0154],
    zoom: 6.5
  }
];

export const getCountryByCode = (code: string): CountryConfig | undefined => {
  return COUNTRIES.find(c => c.code === code);
};