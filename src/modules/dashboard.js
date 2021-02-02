import { cerPalette, conversions } from "../modules/util.js";
const haversine = require("haversine");

export class DashboardMap {
  substanceState = {
    Propane: "gas",
    "Natural Gas - Sweet": "gas",
    "Fuel Gas": "liquid",
    "Lube Oil": "liquid",
  };
  substanceColors = {
    Propane: cerPalette["Forest"],
    "Natural Gas - Sweet": cerPalette["Flame"],
    "Fuel Gas": cerPalette["Sun"],
    "Lube Oil": cerPalette["hcPurple"],
  };

  statusColors = {
    "Initially Submitted": cerPalette["Flame"],
    Closed: cerPalette["Night Sky"],
    Submitted: cerPalette["Ocean"],
  };

  provinceColors = {
    Alberta: cerPalette["Sun"],
    "British Columbia": cerPalette["Forest"],
  };

  constructor(eventType, filters, minRadius, field, baseZoom = [55, -119]) {
    this.eventType = eventType;
    this.filters = filters;
    this.minRadius = minRadius;
    this.field = field;
    this.baseZoom = baseZoom;
    this.colors = this.setColors();
    this.user = { latitude: undefined, longitude: undefined };
  }

  setColors() {
    if (this.eventType == "incidents") {
      return {
        Substance: this.substanceColors,
        Status: this.statusColors,
        Province: this.provinceColors,
      };
    }
  }

  addBaseMap() {
    var map = L.map("incident-map").setView(this.baseZoom, 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?{foo}", {
      foo: "bar",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.setMinZoom(5);
    this.map = map;
  }

  volumeText(m3, substance, gas = false, liquid = false) {
    let convLiquid = conversions["m3 to bbl"];
    let convGas = conversions["m3 to cf"];
    if (!gas && !liquid) {
      var state = this.substanceState[substance];
    } else if (!gas && liquid) {
      var state = "liquid";
    } else {
      var state = "gas";
    }

    if (state == "gas") {
      var imperial = `${Highcharts.numberFormat(
        (m3 * convGas).toFixed(2),
        2,
        "."
      )} cubic feet`;
    } else {
      var imperial = `${Highcharts.numberFormat(
        (m3 * convLiquid).toFixed(2),
        2,
        "."
      )} bbl`;
    }
    return `${imperial} (${Highcharts.numberFormat(m3, 2, ".")} m3)`;
  }

  toolTip(incidentParams, fillColor) {
    const formatCommaList = (text) => {
      if (text.includes(",")) {
        let itemList = text.split(",");
        let brokenText = ``;
        for (var i = 0; i < itemList.length; i++) {
          brokenText += "&nbsp- " + itemList[i] + "<br>";
        }
        return brokenText;
      } else {
        return "&nbsp" + text;
      }
    };

    let toolTipText = `<div id="incident-tooltip"><p style="font-size:15px; font-family:Arial; text-align:center"><b>${incidentParams["Incident Number"]}</b></p>`;
    toolTipText += `<table>`;
    toolTipText += `<tr><td>${
      this.field
    }:</td><td style="color:${fillColor}">&nbsp<b>${
      incidentParams[this.field]
    }</b></td></tr>`;
    toolTipText += `<tr><td>Est. Release Volume:</td><td>&nbsp<b>${this.volumeText(
      incidentParams["Approximate Volume Released"],
      incidentParams.Substance
    )}</b></td></tr>`;
    toolTipText += `<tr><td>What Happened?</td><td><b>${formatCommaList(
      incidentParams["What Happened"]
    )}</b></td></tr>`;
    toolTipText += `<tr><td>Why It Happened?</td><td><b>${formatCommaList(
      incidentParams["Why It Happened"]
    )}</b></td></tr>`;
    toolTipText += `</table></div>`;
    return toolTipText;
  }

  addCircle(x, y, color, fillColor, r, incidentParams = {}) {
    return L.circle([x, y], {
      color: color,
      fillColor: fillColor,
      fillOpacity: 0.7,
      radius: this.minRadius,
      minRadius: r,
      weight: 1,
      incidentParams,
    });
  }

  updateRadius() {
    if (this.filters.type == "volume") {
      this.circles.eachLayer(function (layer) {
        try {
          layer.setRadius(layer.options["minRadius"]);
        } catch (err) {
          layer.setRadius(0);
          console.log("Error setting new radius");
        }
      });
    } else {
      let currZoom = this.map.getZoom();
      var minRadius = this.minRadius;
      if (currZoom >= 7) {
        this.circles.eachLayer(function (layer) {
          layer.setRadius(minRadius / 2);
        });
      } else if (currZoom <= 6) {
        this.circles.eachLayer(function (layer) {
          layer.setRadius(minRadius);
        });
      }
    }
  }

  processIncidents(data) {
    const radiusCalc = (maxVolume) => {
      if (maxVolume > 500) {
        return 150000;
      } else {
        return 100000;
      }
    };

    let years = []; //piggyback on data processing pass to get the year colors
    let colors = [
      cerPalette["Sun"],
      cerPalette["Night Sky"],
      "#1d5478",
      "#366687",
      "#507a96",
      "#698da5",
      "#82a0b4",
      "#9bb3c3",
      "#b4c6d2",
      "#cdd9e1",
      "#e6ecf0",
      "#ffffff",
    ];
    let volumes = data.map((row) => {
      return row["Approximate Volume Released"];
    });
    let [maxVol, minVol] = [Math.max(...volumes), Math.min(...volumes)];
    let maxRad = radiusCalc(maxVol);
    let allCircles = data.map((row) => {
      years.push(row.Year);
      let t = (row["Approximate Volume Released"] - minVol) / (maxVol - minVol);
      t = t * (maxRad - 5000) + 5000;
      return this.addCircle(
        row.Latitude,
        row.Longitude,
        cerPalette["Cool Grey"],
        this.colors[this.field][row[this.field]],
        t,
        row
      );
    });
    years = years.filter((v, i, a) => a.indexOf(v) === i); //get unique years
    years = years.sort(function (a, b) {
      return b - a;
    });
    let yearColors = {};
    years.map((yr, i) => {
      yearColors[yr] = colors[i];
    });
    this.colors.Year = yearColors;
    let circles = L.featureGroup(allCircles).addTo(this.map);
    this.circles = circles;
    let currentDashboard = this;
    this.map.on("zoom", function (e) {
      currentDashboard.updateRadius();
    });
  }

  async findUser() {
    return new Promise((resolve, reject) => {
      let currentDashboard = this;
      this.map
        .locate({
          //setView: true,
          watch: false,
        }) /* This will return map so you can do chaining */
        .on("locationfound", function (e) {
          var marker = L.marker([e.latitude, e.longitude], {
            draggable: true,
          }).bindPopup(
            "Approximate location. You can drag this marker around to explore incident events in other locations."
          );
          marker.on("drag", function (e) {
            var marker = e.target;
            var position = marker.getLatLng();
            currentDashboard.user.latitude = position.lat;
            currentDashboard.user.longitude = position.lng;
          });
          marker.id = "userLocation";
          currentDashboard.map.addLayer(marker);
          currentDashboard.user.latitude = e.latitude;
          currentDashboard.user.longitude = e.longitude;
          currentDashboard.user.layer = marker;
          resolve(currentDashboard);
        })
        .on("locationerror", function (e) {
          reject(currentDashboard);
        });
    });
  }

  async waitOnUser() {
    try {
      return await this.findUser();
    } catch (err) {
      var incidentFlag = document.getElementById("nearby-flag");
      incidentFlag.innerHTML = `<section class="alert alert-warning"><h4>Cant access your location.</h4>Try enabling your browser's location services and refresh the page.</section>`;
    }
  }

  nearbyIncidents(range) {
    var [nearbyCircles, allCircles] = [[], []];
    var currentDashboard = this;
    this.circles.eachLayer(function (layer) {
      allCircles.push(layer);
      let incLoc = layer._latlng;
      let distance = haversine(currentDashboard.user, {
        latitude: incLoc.lat,
        longitude: incLoc.lng,
      });
      if (distance > range) {
        layer.setStyle({ fillOpacity: 0 });
      } else {
        nearbyCircles.push(layer);
        layer.setStyle({ fillOpacity: 0.7 });
      }
    });
    var incidentFlag = document.getElementById("nearby-flag");

    let userDummy = L.circle([this.user.latitude, this.user.longitude], {
      color: undefined,
      fillColor: undefined,
      fillOpacity: 0,
      radius: 1,
      weight: 1,
    });
    userDummy.addTo(this.map);

    if (nearbyCircles.length > 0) {
      this.nearby = L.featureGroup(nearbyCircles);
      let bounds = this.nearby.getBounds();
      bounds.extend(userDummy.getBounds());
      this.map.fitBounds(bounds, { maxZoom: 15 });
      // loop through the nearbyCircles and get some summary stats:
      let [nearbyGas, nearbyLiquid] = [0, 0];
      let currentDashboard = this;
      this.nearby.eachLayer(function (layer) {
        let layerState =
          currentDashboard.substanceState[
            layer.options.incidentParams.Substance
          ];
        if (layerState == "gas") {
          nearbyGas +=
            layer.options.incidentParams["Approximate Volume Released"];
        } else if (layerState == "liquid") {
          nearbyLiquid +=
            layer.options.incidentParams["Approximate Volume Released"];
        } //TODO: add an "Other" option here
      });
      let nearbyText = ``;
      nearbyText += `<section class="alert alert-info"><h4>There are ${nearbyCircles.length} incidents within ${range} km</h4><table>`;
      nearbyText += `<tr><td>
        Estimated gas volume released:&nbsp&nbsp</td><td>${this.volumeText(
          nearbyGas,
          undefined,
          true
        )}`;
      nearbyText += `<tr><td>
        Estimated liquid volume released:&nbsp&nbsp</td><td>${this.volumeText(
          nearbyLiquid,
          undefined,
          false,
          true
        )}`;
      nearbyText += `</table><br><small>Want to explore other regions? You can click and drag the location marker and re-click the find incidents button.</small>
        </section>`;
      incidentFlag.innerHTML = nearbyText;
    } else {
      let userZoom = L.featureGroup(allCircles);
      let bounds = userZoom.getBounds();
      bounds.extend(userDummy.getBounds());
      this.map.fitBounds(bounds, { maxZoom: 15 });
      incidentFlag.innerHTML = `<section class="alert alert-warning"><h4>No nearby incidents</h4>Try increasing the search range.</section>`;
    }
  }

  reZoom() {
    let bounds = this.circles.getBounds();
    this.map.fitBounds(bounds, { maxZoom: 5 });
  }

  resetMap() {
    this.circles.eachLayer(function (layer) {
      layer.setStyle({ fillOpacity: 0.7 });
    });
    this.reZoom();
  }

  fieldChange(newField) {
    let newColors = this.colors[newField];
    this.field = newField;
    var currentDashboard = this;
    this.circles.eachLayer(function (layer) {
      let newFill = newColors[layer.options.incidentParams[newField]];
      layer.setStyle({
        fillColor: newFill,
      });
      layer.bindTooltip(
        currentDashboard.toolTip(layer.options.incidentParams, newFill)
      );
    });
  }

  lookForSize() {
    var currentDashboard = this;
    var resize = false;
    $(window).on("resize", function () {
      resize = true;
    });
    $(".tab > .tablinks").on("click", function (e) {
      currentDashboard.reZoom();
      if (resize) {
        currentDashboard.map.invalidateSize(true);
        resize = false;
      } else {
        currentDashboard.map.invalidateSize(false);
      }
    });
  }
}

export class DashboardNav {
  legends = {
    Substance: {
      layout: "horizontal",
      width: 350,
      itemStyle: {
        fontSize: 12,
      },
      padding: 0,
      itemMarginTop: 0,
      margin: 0,
      y: -20,
      x: 50,
    },
    Status: {
      layout: "horizontal",
      width: 325,
      itemStyle: {
        fontSize: 12,
      },
      padding: 0,
      margin: 0,
      y: -20,
      x: 40,
    },
    Province: {
      layout: "horizontal",
      itemStyle: {
        fontSize: 12,
      },
      padding: 0,
      margin: 0,
      y: -20,
    },
    Year: {
      layout: "horizontal",
      reversed: true,
      width: 300,
      itemStyle: {
        fontSize: 12,
      },
      padding: 0,
      margin: 5,
      y: -20,
      x: 12,
    },
  };

  constructor(map, currentActive, barList, bars) {
    this.map = map;
    this.currentActive = currentActive;
    this.barList = barList;
    this.bars = bars;
    this.barColors = map.colors;
    this.allDivs = [];
  }

  seriesify(name, series, colors, yVal) {
    const seriesProps = (colors) => {
      if (colors) {
        return function (key, value, name, yVal, colors) {
          return {
            name: key,
            data: [{ name: name, y: value[yVal] }],
            color: colors[name][key],
            filter: yVal,
          };
        };
      } else {
        return function (key, value, name, yVal, colors) {
          return {
            name: key,
            data: [{ name: name, y: value[yVal] }],
            filter: yVal,
          };
        };
      }
    };

    var seriesParams = seriesProps(colors);
    let seriesList = [];
    for (const [key, value] of Object.entries(series[name])) {
      seriesList.push(seriesParams(key, value, name, yVal, colors));
    }
    return seriesList;
  }

  createBar(div, name, series, colors) {
    function barTitle(name) {
      if (name == "Status") {
        return `CER ${name}`;
      } else {
        return `${name}`;
      }
    }

    return new Highcharts.chart(div, {
      chart: {
        type: "bar",
        spacingRight: 10,
        spacingLeft: 4,
        spacingTop: 5,
        spacingBottom: 0,
        animation: false,
      },

      title: {
        text: barTitle(name),
        padding: 0,
        margin: -10,
      },

      credits: {
        text: "",
      },

      xAxis: {
        visible: false,
        categories: true,
        gridLineWidth: 0,
      },

      yAxis: {
        maxPadding: 0,
        visible: true,
        plotLines: [
          {
            color: "white",
            value: 0,
            width: 1,
            zIndex: 5,
          },
        ],
        labels: {
          enabled: false,
        },
        gridLineWidth: 0,
        startOnTick: false,
        endOnTick: false,
        min: 0,
        title: {
          text: "",
        },
      },

      tooltip: {
        snap: 0,
        useHTML: true,
        formatter: function () {
          if (this.series.options.filter == "frequency") {
            return `${this.series.name} - ${this.y}`;
          } else if (this.series.options.filter == "volume") {
            return `${this.series.name} - <b>${Highcharts.numberFormat(
              this.y,
              0,
              "."
            )} m3</b>`;
          }
        },
      },

      legend: {
        layout: "horizontal",
        padding: 0,
        itemMarginTop: -2,
        itemMarginBottom: -2,
        y: -20,
      },

      plotOptions: {
        bar: {
          pointWidth: 30,
        },
        series: {
          animation: false,
          stacking: "normal",
          grouping: false,
          shadow: false,
          borderWidth: 0,
          states: {
            inactive: {
              opacity: 1,
            },
            hover: {
              enabled: false,
            },
          },
          events: {
            legendItemClick: function () {
              return false;
            },
          },
        },
      },

      series: this.seriesify(name, series, colors, "frequency"),
    });
  }

  prepareData(data) {
    var [substance, status, province, year] = [{}, {}, {}, {}];
    const addToSeries = (series, row, name) => {
      if (series.hasOwnProperty(row[name])) {
        series[row[name]].frequency += 1;
        series[row[name]].volume += row["Approximate Volume Released"];
      } else {
        series[row[name]] = {
          frequency: 1,
          volume: row["Approximate Volume Released"],
        };
      }
      return series;
    };

    data.map((row) => {
      substance = addToSeries(substance, row, "Substance");
      status = addToSeries(status, row, "Status");
      province = addToSeries(province, row, "Province");
      year = addToSeries(year, row, "Year");
    });

    this.barSeries = {
      Substance: substance,
      Status: status,
      Province: province,
      Year: year,
    };
  }

  deactivateChart(bar) {
    var chart = bar.chart;
    var div = bar.div;
    if (div !== "year-bar") {
      var greyColors = ["#CCCCCC", "#999999", "#666666", "#333333", "#000000"];
    } else {
      var greyColors = [
        "#101010",
        "#282828",
        "#404040",
        "#585858",
        "#696969",
        "#808080",
        "#989898",
        "#A9A9A9",
        "#BEBEBE",
        "#D0D0D0",
        "#DCDCDC",
        "#F0F0F0",
        "#FFFFFF",
      ].reverse();
    }

    chart.series.map((s, i) => {
      chart.series[i].options.color = greyColors[i];
      chart.series[i].update(chart.series[i].options);
    });
    chart.update({
      title: { text: `${chart.title.textStr} (click to view)` },
      plotOptions: {
        series: {
          states: {
            hover: {
              enabled: false,
            },
          },
        },
      },
      tooltip: {
        enabled: false,
      },
    });
    let activeDiv = document.getElementById(div);
    activeDiv.style.borderStyle = "solid";
    activeDiv.style.borderColor = cerPalette["Dim Grey"];
    activeDiv.style.borderRadius = "5px";
    activeDiv.style.opacity = 0.5;
  }

  activateChart(bar) {
    let colors = this.barColors[bar.name];
    let chart = bar.chart;
    let div = bar.div;
    chart.series.map((s, i) => {
      chart.series[i].options.color = colors[s.name];
      chart.series[i].update(chart.series[i].options);
    });
    let activeTitle = chart.title.textStr;
    if (activeTitle.includes("(")) {
      activeTitle = activeTitle.split("(")[0];
    }
    chart.update({
      chart: {
        backgroundColor: "white",
      },
      title: {
        text: activeTitle,
      },
      plotOptions: {
        series: {
          states: {
            hover: {
              enabled: true,
            },
          },
        },
      },
      tooltip: {
        enabled: true,
      },
    });
    this.currentActive = bar;
    let activeDiv = document.getElementById(div);
    activeDiv.style.borderStyle = "solid";
    activeDiv.style.borderColor = cerPalette["Cool Grey"];
    activeDiv.style.borderRadius = "5px";
    activeDiv.style.opacity = 1;
    this.map.fieldChange(bar.name);
  }

  barEvents(bar) {
    var barDiv = document.getElementById(bar.div);
    var barNav = this;
    function mouseOver() {
      if (bar.status !== "activated") {
        barDiv.style.opacity = 1;
        bar.chart.update({
          chart: {
            backgroundColor: "#F0F8FF",
          },
        });
      }
    }

    function mouseOut() {
      if (bar.status !== "activated") {
        barDiv.style.opacity = 0.5;
        bar.chart.update({
          chart: {
            backgroundColor: "white",
          },
        });
      }
    }

    function click() {
      // deactivate current active bar
      barNav.deactivateChart(barNav.currentActive);
      barNav.currentActive.status = "deactivated";
      // activate the clicked bar
      bar.status = "activated";
      barNav.activateChart(bar);
    }

    barDiv.addEventListener("mouseover", mouseOver);
    barDiv.addEventListener("mouseout", mouseOut);
    barDiv.addEventListener("click", click);
  }

  makeBar(barName, div, status) {
    let newBar = {
      chart: this.createBar(div, barName, this.barSeries, this.barColors),
      status: status,
      div: div,
      name: barName,
    };
    this.allDivs.push(div);
    this.barList.push(newBar);
    this.bars[barName] = newBar;
    this.formatLegend(barName);
    if (status == "activated") {
      this.activateChart(newBar);
    } else if ((status = "deactivated")) {
      this.deactivateChart(newBar);
    }
  }

  formatLegend(barName) {
    let legendParams = this.legends[barName];
    this.bars[barName].chart.update({
      legend: legendParams,
    });
  }

  divEvents() {
    this.barList.map((bar) => {
      this.barEvents(bar);
    });
  }

  // get allDivs() {
  //   return this.allDivs;
  // }

  switchY(newY) {
    this.barList.map((bar) => {
      let newSeries = this.seriesify(bar.name, this.barSeries, undefined, newY);
      bar.chart.update({
        series: newSeries,
      });
    });
  }
}