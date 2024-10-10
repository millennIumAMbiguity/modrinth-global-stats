const modChart = { chart: null };
const modActivityChart = { chart: null };
const fabricDownloadChart = { chart: null };
let versions = []; // You can filter the versions by adding them here, when empty it will fetch all versions
let timestamp = 0;

function setWithExpiry(key, value, ttl = 86400000) {
  const now = new Date();

  const item = {
    value: value,
    expiry: now.getTime() + ttl,
  };
  localStorage.setItem(key, JSON.stringify(item));
}

function setCookie(cname, cvalue) {
  const d = new Date();
  d.setTime(d.getTime() + 86400000);
  let expires = "expires=" + d.toUTCString();
  document.cookie =
    cname + "=" + JSON.stringify(cvalue) + ";" + expires + ";path=/";
}

function getWithExpiry(key) {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) {
    return null;
  }
  const item = JSON.parse(itemStr);
  const now = new Date();
  if (now.getTime() > item.expiry) {
    localStorage.removeItem(key);
    return null;
  }

  return item.value;
}

function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return JSON.parse(c.substring(name.length, c.length));
    }
  }
  return "";
}

async function fetchGameVersions() {
  if (versions.length > 0) return versions;

  const cachedVersions = getCookie("game_versions");
  if (cachedVersions) return (versions = cachedVersions);

  const url = `https://api.modrinth.com/v2/tag/game_version`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    versions = data
      .filter((item) => item.version_type === "release")
      .map((item) => item.version);
    setCookie("game_versions", versions);
    return versions;
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

async function fetchModCountForVersion(version) {
  const url = `https://api.modrinth.com/v2/search?facets=[["versions:${version}"]]&limit=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.total_hits;
  } catch (error) {
    console.error("Error fetching data:", error);
    return 0;
  }
}

async function fetchModActivityLast30Days(version) {
  const url = `https://api.modrinth.com/v2/search?facets=[["versions:${version}"],["created_timestamp>=${timestamp}"]]&limit=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.total_hits;
  } catch (error) {
    console.error("Error fetching mod activity:", error);
    return 0;
  }
}

async function fetchFabricVersions() {
  const url = `https://api.modrinth.com/v2/project/P7dR8mSH/version`;

  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Error fetching data:", error);
    return 0;
  }
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + "K";
  } else {
    return num.toString();
  }
}

function setChart(element, chartObj) {
  chartObj.chart = new Chart(element.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [
        {
          label: "Number of Projects",
          data: [],
          backgroundColor: [],
          borderColor: "#16181c",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      layout: { padding: 40 },
      plugins: {
        legend: { position: "bottom", display: false },
        tooltip: {
          callbacks: {
            label: function (tooltipItem) {
              return `Minecraft ${tooltipItem.label}: ${formatNumber(
                tooltipItem.raw
              )} projects`;
            },
          },
        },
        datalabels: {
          anchor: "end",
          align: "end",
          offset: 10,
          formatter: (value, ctx) => {
            const totalMods = chartObj.chart.data.datasets[0].data.reduce(
              (a, b) => a + b,
              0
            );
            const percentage = ((value / totalMods) * 100).toFixed(2) + "%";
            if (percentage < 1) return "";
            return ctx.chart.data.labels[ctx.dataIndex] + ": " + percentage;
          },
          color: "#b0bac5",
          backgroundColor: "#26292f",
          borderColor: "#16181c",
          borderWidth: 1,
          borderRadius: 3,
          padding: { top: 6, bottom: 6, left: 10, right: 10 },
          font: {
            family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI"',
            size: 12,
          },
        },
      },
    },
    plugins: [ChartDataLabels],
  });
}

function getDate30DaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 30);

  return (timestamp = date.getTime() / 1000);
}

function updateChartAndSort(chartObj, modCounts, groupLimit = 2) {
  const totalMods = modCounts.reduce((sum, item) => sum + item.c, 0);
  const significantVersions = [];
  const significantCounts = [];
  let otherModsCount = 0;

  for (let item of modCounts) {
    const percentage = (item.c / totalMods) * 100;
    if (percentage >= groupLimit) {
      significantVersions.push(item.v);
      significantCounts.push(item.c);
    } else {
      otherModsCount += item.c;
    }
  }

  if (otherModsCount > 0) {
    significantVersions.push("Others");
    significantCounts.push(otherModsCount);
  }

  updateChart(
    chartObj,
    significantVersions.map((v, i) => ({
      v: v,
      c: significantCounts[i],
    })),
    true
  );
}

// Function to update the mod version chart
function updateChart(chartObj, modCounts, withPercentages) {
  const c = chartObj.chart;
  c.data.labels = modCounts.map((item) => item.v);
  c.data.datasets[0].data = modCounts.map((item) => item.c);
  c.data.datasets[0].backgroundColor = generateColors(modCounts.length);
  c.options.plugins.datalabels.formatter = (value, ctx) => {
    if (withPercentages) {
      const totalMods = c.data.datasets[0].data.reduce((a, b) => a + b, 0);
      let percentage = ((value / totalMods) * 100).toFixed(2) + "%";
      return ctx.chart.data.labels[ctx.dataIndex] + ": " + percentage;
    } else {
      return ctx.chart.data.labels[ctx.dataIndex];
    }
  };
  c.update();
}

// Helper function to generate random colors for the chart
function generateColors(count) {
  const colors = [
    "#ff6384",
    "#36a2eb",
    "#ffcd56",
    "#4bc0c0",
    "#9966ff",
    "#ff9f40",
  ];
  const generatedColors = [];
  for (let i = 0; i < count; i++) {
    generatedColors.push(colors[i % colors.length]);
  }
  return generatedColors;
}

async function displayModCounts() {
  const versions = await fetchGameVersions();
  let modCounts = [];

  // Initialize mod version chart
  setChart(document.getElementById("modChart"), modChart);

  const cashedCounts = getCookie("mod_counts");
  if (cashedCounts) {
    modCounts = cashedCounts;
  } else {
    const loading = [{ v: "loading%", c: "0" }];
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i];
      const c = await fetchModCountForVersion(v);
      modCounts.push({ v, c });

      if (i % 2 == 0) {
        loading[0].v =
          "loading: " + Math.floor((i * 100) / versions.length) + "%";
        updateChart(modChart, loading);
      }
    }

    modCounts.sort((a, b) => b.c - a.c);
    setCookie("mod_counts", modCounts);
  }

  updateChartAndSort(modChart, modCounts);
}

// Function to display mod activity in the last 30 days
async function displayModActivityLast30Days() {
  const versions = await fetchGameVersions();
  let modCounts = [];

  // Initialize the second chart for mod activity
  setChart(document.getElementById("modActivityChart"), modActivityChart);

  const cashedCounts = getCookie("new_mods");
  if (cashedCounts) {
    modCounts = cashedCounts;
  } else {
    const loading = [{ v: "loading%", c: "0" }];
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i];
      const c = await fetchModActivityLast30Days(v);
      modCounts.push({ v, c });

      if (i % 2 == 0) {
        loading[0].v =
          "loading: " + Math.floor((i * 100) / versions.length) + "%";
        updateChart(modActivityChart, loading);
      }
    }

    modCounts.sort((a, b) => b.c - a.c);
    setCookie("new_mods", modCounts);
  }

  updateChartAndSort(modActivityChart, modCounts);
}

async function displayFabricApiDownlods() {
  let versions = await fetchGameVersions();
  // Filter versions to only include 1.14 and above because Fabric is only available for 1.14+
  versions = versions.filter((item) => item >= "1.14");
  let result = [];

  setChart(document.getElementById("fabricDownloadChart"), fabricDownloadChart);

  const cashedCounts = getCookie("fabric_downloads");
  if (cashedCounts) {
    result = cashedCounts;
  } else {
    const downloadsList = await fetchFabricVersions();

    downloadsList.forEach((item) => {
      item.game_versions.forEach((version) => {
        if (versions.includes(version)) {
          // Check if the version is already in the result
          const existingVersion = result.find((v) => v.v === version);

          if (existingVersion) {
            // If it exists, accumulate the download count
            existingVersion.c += item.downloads;
          } else {
            // If it doesn't exist, add a new entry
            result.push({ v: version, c: item.downloads });
          }
        }
      });
    });

    result.sort((a, b) => b.c - a.c);
    setCookie("fabric_downloads", result);
  }

  updateChartAndSort(fabricDownloadChart, result, 1);
}

getDate30DaysAgo();
displayModCounts();
displayModActivityLast30Days();
displayFabricApiDownlods();
