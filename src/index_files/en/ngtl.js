console.time(`chart loading`);
import { generalTheme } from "../../modules/themes.js";
import ieWarn from "ie-gang";
// conditions
import econRegions from "../../conditions/NOVAGasTransmissionLtd/economicRegions.json";
import canadaMap from "../../conditions/base_maps/base_map.json";
import mapMetaData from "../../conditions/NOVAGasTransmissionLtd/mapMetadata.json";
import metaConditions from "../../conditions/NOVAGasTransmissionLtd/summaryMetadata.json";
import { mainConditions } from "../../conditions/conditionsDashboard.js";
// incidents
import incidentData from "../../incidents/NOVAGasTransmissionLtd/incidents_map.json";
import metaIncidents from "../../incidents/NOVAGasTransmissionLtd/summaryMetadata.json";
import { mainIncidents } from "../../incidents/incidentsDashboard.js";
// settlements
// import settlementsData from "../settlements/NOVAGasTransmissionLtd/settlementsData.json";
// import { mainSettlements } from "../settlements/settlementsDashboard.js";
// language
import { englishDashboard } from "../../modules/langEnglish.js";
// load dashboards
import { loadAllCharts } from "../loadDashboards.js";

let warningParams = {
  message:
    "We noticed you are using Internet Explorer. Please consider using a different browser for a better experience on this page.",
  type: "alert",
  title: "Old Browser Warning",
  applyIE: false,
};

ieWarn(warningParams);
generalTheme();

const arrayOfCharts = [
  mainConditions(
    econRegions,
    canadaMap,
    mapMetaData,
    metaConditions,
    englishDashboard.conditions
  ),
  mainIncidents(incidentData, metaIncidents, englishDashboard.incidents),
];

loadAllCharts(arrayOfCharts);