// Inspired from: https://observablehq.com/@d3/radial-area-chart/2

console.log("Hello from script.js rendering the custom chart");

const locations = [
  {
    id: "sfo",
    text: "San Francisco",
    dataFile: "sfo-temperature-data.csv",
    pathColor: "steelblue",
  },
  {
    id: "ord",
    text: "Chicago",
    dataFile: "ord-temperature-data.csv",
    pathColor: "tomato",
  },
];

const initialLocationIndex = 0;

function populateDropdown(allData) {
  // populate the chart dropdown div
  const dropdownContainer = document.querySelector("#chart-dropdown");
  const dropdownElement = document.createElement("select");
  locations.forEach((location) => {
    let option = document.createElement("option");
    option.text = location.text;
    option.value = location.id;
    dropdownElement.add(option);
  });
  if (dropdownContainer) dropdownContainer.appendChild(dropdownElement);

  // add event listener for dropdown
  dropdownContainer.addEventListener("change", (event) => {
    console.log("Dropdown changed to", event.target.value);
    const newData = allData[event.target.value];
    updateViz(newData, event.target.value);
  });
}

// load data from both URLs
async function loadData() {
  function getDataURL(location) {
    return `https://kristinbaumann.github.io/example-adding-interactivity-to-embedded-d3-chart-in-webflow/data/${location}-temperature-data.csv`;
  }
  return Promise.all([
    d3.csv(getDataURL("sfo"), d3.autoType),
    d3.csv(getDataURL("ord"), d3.autoType),
  ]).then((datasets) => {
    const [dataSFO, dataORD] = datasets;

    const processData = (data) => {
      return d3
        .groups(
          data,
          ({ DATE }) =>
            new Date(
              Date.UTC(
                2000,
                new Date(DATE).getUTCMonth(),
                new Date(DATE).getUTCDate()
              )
            ) // group by day of year
        )
        .sort(([a], [b]) => d3.ascending(a, b)) // sort chronologically
        .map(([date, v]) => ({
          date,
          avg: d3.mean(v, (d) => d.TAVG || NaN),
          min: d3.mean(v, (d) => d.TMIN || NaN),
          max: d3.mean(v, (d) => d.TMAX || NaN),
        }));
    };
    const groupedData = {
      sfo: processData(dataSFO),
      ord: processData(dataORD),
    };
    return groupedData;
  });
}

(async function () {
  const allData = await loadData();
  populateDropdown(allData);
  drawViz(allData);
})();

// dimensions
const width = 900;
const height = width;
const margin = 10;
const innerRadius = width / 5;
const outerRadius = width / 2 - margin;

// scales
const x = d3
  .scaleUtc()
  .domain([new Date("2000-01-01"), new Date("2001-01-01") - 1])
  .range([0, 2 * Math.PI]);

const y = d3
  .scaleRadial()
  // .domain([d3.min(data, (d) => d.minmin), d3.max(data, (d) => d.maxmax)])
  .range([innerRadius, outerRadius]);

// line and area generators
const line = d3
  .lineRadial()
  .curve(d3.curveLinearClosed)
  .angle((d) => x(d.date));

const area = d3
  .areaRadial()
  .curve(d3.curveLinearClosed)
  .angle((d) => x(d.date));

function drawViz(groupedData) {
  console.log("groupedData", groupedData);
  const data = groupedData[locations[initialLocationIndex].id];
  console.log("drawn data", data);

  y.domain([d3.min(data, (d) => d.min), d3.max(data, (d) => d.max)]);

  // create svg
  const svg = d3
    .select("#chart-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("style", "width: 100%; height: auto; font-size: 10px;")
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round");

  // draw background areas
  // svg
  //   .append("path")
  //   .attr("class", "big-area")
  //   .attr("fill", "lightsteelblue")
  //   .attr("fill-opacity", 0.2)
  //   .attr(
  //     "d",
  //     area.innerRadius((d) => y(d.minmin)).outerRadius((d) => y(d.maxmax))(data)
  //   );
  svg
    .append("path")
    .attr("class", "min-max-area")
    .attr("fill", locations[initialLocationIndex].pathColor)
    .attr("fill-opacity", 0.2)
    .attr(
      "d",
      area.innerRadius((d) => y(d.min)).outerRadius((d) => y(d.max))(data)
    );
  // draw average line
  svg
    .append("path")
    .attr("class", "avg-line")
    .attr("fill", "none")
    .attr("stroke", locations[initialLocationIndex].pathColor)
    .attr("stroke-width", 1.5)
    .attr("d", line.radius((d) => y(d.avg))(data));

  // draw months lines and labels
  svg
    .append("g")
    .attr("class", "months")
    .selectAll()
    .data(x.ticks())
    .join("g")
    .each((d, i) => (d.id = `month-${i}`))
    .call((g) =>
      g
        .append("path")
        .attr("stroke", "#000")
        .attr("stroke-opacity", 0.15)
        .attr(
          "d",
          (d) => `
          M${d3.pointRadial(x(d), innerRadius)}
          L${d3.pointRadial(x(d), outerRadius)}
        `
        )
    )
    .call((g) =>
      g
        .append("path")
        .attr("id", (d) => d.id)
        .datum((d) => [d, d3.utcMonth.offset(d, 1)])
        .attr("fill", "none")
        .attr(
          "d",
          ([a, b]) => `
          M${d3.pointRadial(x(a), innerRadius)}
          A${innerRadius},${innerRadius} 0,0,1 ${d3.pointRadial(
            x(b),
            innerRadius
          )}
        `
        )
    )
    .call((g) =>
      g
        .append("text")
        .append("textPath")
        .attr("startOffset", 6)
        .attr("xlink:href", (d) => "#" + d.id)
        .text(d3.utcFormat("%B"))
    );

  // draw temperature labels
  svg
    .append("g")
    .attr("text-anchor", "middle")
    .selectAll()
    .data(y.ticks(6).reverse())
    .join("g")
    .call((g) =>
      g
        .append("circle")
        .attr("fill", "none")
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.15)
        .attr("r", y)
    )
    .call((g) =>
      g
        .append("text")
        .attr("y", (d) => -y(d))
        .attr("dy", "0.35em")
        .attr("stroke", "#fff")
        .attr("stroke-width", 5)
        .attr("fill", "currentColor")
        .attr("paint-order", "stroke")
        .text((x, i) => `${x.toFixed(0)}${i ? "" : "°F"}`)
        .clone(true)
        .attr("y", (d) => y(d))
    );

  // draw headline in center
  const headlineGroup = svg
    .append("g")
    .attr("class", "headline-group")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("style", "font-size: 1.5em;");

  headlineGroup
    .append("text")
    .text("Daily average temperature range")
    .attr("dy", "-1em");
  headlineGroup
    .append("text")
    .text("and recorded extremes in San Francisco")
    .attr("dy", "0em");
  headlineGroup.append("text").text("from 1999–2018").attr("dy", "1em");
}

function updateViz(newData, locationId) {
  console.log("Updating the viz");

  let svg = d3.select("#chart-container").transition();

  // update the y scale
  y.domain([d3.min(newData, (d) => d.min), d3.max(newData, (d) => d.max)]);

  // change the line
  svg
    .select(".avg-line")
    .duration(750)
    .attr("stroke", locations.find((loc) => loc.id === locationId).pathColor)
    .attr("d", line.radius((d) => y(d.avg))(newData));

  // change the big area
  // svg.select(".big-area").duration(750).attr("d", area(newData));
}
