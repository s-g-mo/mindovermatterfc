// ─────────────────────────────────────────────────────────────────────────────
// Lifetime stats (doughnut chart + metric boxes)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchData() {
  const response = await fetch("/api/data");
  const data = await response.json();
  window.dashboardData = data;

  document.querySelector("#first-dropdown-menu").value = "All";
  updateMetrics("All");

  const chartData = data
    .filter((d) => d.game_type !== "All")
    .map((d) => ({ label: d.game_type, value: d.games_played }));
  renderPieChart(chartData, "All");

  document
    .querySelector("#first-dropdown-menu")
    .addEventListener("change", function (event) {
      const selectedType = event.target.value;
      updateMetrics(selectedType);
      const chartData = data
        .filter((d) => d.game_type !== "All")
        .map((d) => ({ label: d.game_type, value: d.games_played }));
      renderPieChart(chartData, selectedType);
    });
}

function updateMetrics(gameType) {
  const data = window.dashboardData;
  const selectedData = data.find((d) => d.game_type === gameType);

  if (selectedData) {
    document.getElementById("games-played").innerText = selectedData.games_played;
    document.getElementById("goals-scored").innerText = selectedData.goals;
    document.getElementById("goals-per-game").innerText =
      selectedData.goals_per_game.toFixed(2);
    document.getElementById("assists").innerText = selectedData.assists;
    document.getElementById("assists-per-game").innerText =
      selectedData.assists_per_game.toFixed(2);
  } else {
    ["games-played", "goals-scored", "goals-per-game", "assists", "assists-per-game"].forEach(
      (id) => (document.getElementById(id).innerText = "--")
    );
  }
}

function renderPieChart(data, selectedGameType = "All") {
  const width = 220;
  const height = 220;
  const radius = Math.min(width, height) / 2;

  const color = d3.scaleOrdinal(["#3ecf8e", "#4b9cd3", "#a78bfa"]);

  const arc = d3.arc().innerRadius(radius * 0.3).outerRadius(radius);
  const pie = d3.pie().value((d) => d.value).sort(null);

  d3.select("#doughnut-chart").selectAll("*").remove();

  const svg = d3
    .select("#doughnut-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  const defs = svg.append("defs");
  const filter = defs
    .append("filter")
    .attr("id", "glow")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%");
  filter.append("feGaussianBlur").attr("stdDeviation", "7.5").attr("result", "coloredBlur");
  const feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  const totalGames = data.reduce((acc, d) => acc + d.value, 0);

  svg
    .selectAll("path")
    .data(pie(data))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => color(d.data.label))
    .style("filter", (d) =>
      d.data.label === selectedGameType && selectedGameType !== "All"
        ? "url(#glow)"
        : null
    );

  svg
    .selectAll("text")
    .data(pie(data))
    .enter()
    .append("text")
    .attr("transform", (d) => `translate(${arc.centroid(d)})`)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .style("font-family", "Inter")
    .style("fill", "#ffffff")
    .style("font-weight", "bold")
    .text((d) => {
      const percentage = ((d.data.value / totalGames) * 100).toFixed(1);
      return `${d.data.label}: ${percentage}%`;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Game-by-game evolution (line chart)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGameStats() {
  const response = await fetch("/api/game-stats");
  const data = await response.json();
  window.dashboardStats = data;

  renderStatGraph("All", "Goals_Per_Game");

  document.getElementById("second-dropdown-menu").addEventListener("change", (event) => {
    renderStatGraph(event.target.value, document.getElementById("stat-select-menu").value);
  });

  document.getElementById("stat-select-menu").addEventListener("change", (event) => {
    renderStatGraph(document.getElementById("second-dropdown-menu").value, event.target.value);
  });
}

function renderStatGraph(gameType, statType) {
  const { width: chartWidth, height: chartHeight } = responsiveChartSize();
  d3.select("#game-evolution-chart").selectAll("*").remove();

  const labelMap = { Goals_Per_Game: "Goals Per Game", Win_Percentage: "Win %" };
  renderLineGraph(
    window.dashboardStats[gameType],
    labelMap[statType] || statType,
    "Time",
    statType,
    chartWidth,
    chartHeight
  );
}

function renderLineGraph(data, yLabel, xLabel, statKey, width = 800, height = 400) {
  const margin = { top: 20, right: 30, bottom: 70, left: 90 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const parseDate = d3.timeParse("%Y-%m-%d");
  const parsedData = data.map((d) => ({
    ...d,
    Date: parseDate(d.Date),
    [statKey]: +d[statKey],
  }));

  d3.select("#game-evolution-chart").selectAll("*").remove();

  const svg = d3
    .select("#game-evolution-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime().domain(d3.extent(parsedData, (d) => d.Date)).range([0, innerWidth]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(parsedData, (d) => d[statKey]) || 1])
    .nice()
    .range([innerHeight, 0]);

  svg
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %Y")));
  svg.append("g").call(d3.axisLeft(y));

  svg
    .append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""))
    .selectAll("line")
    .attr("stroke", "#ccc")
    .attr("stroke-dasharray", "4 2")
    .attr("stroke-opacity", 0.5);

  svg
    .append("path")
    .datum(parsedData)
    .attr("fill", "none")
    .attr("stroke", "#4b9cd3")
    .attr("stroke-width", 2)
    .attr("d", d3.line().x((d) => x(d.Date)).y((d) => y(d[statKey])));

  svg
    .selectAll("dot")
    .data(parsedData)
    .enter()
    .append("circle")
    .attr("r", 4)
    .attr("cx", (d) => x(d.Date))
    .attr("cy", (d) => y(d[statKey]))
    .attr("fill", "#3ecf8e");

  svg
    .selectAll("text.label")
    .data(parsedData)
    .enter()
    .append("text")
    .filter((d, i) => i === data.length - 1)
    .attr("x", (d) => x(d.Date) - 8)
    .attr("y", (d) => y(d[statKey]) - 8)
    .text((d) => d[statKey].toFixed(2))
    .attr("font-size", "12px")
    .attr("fill", "#fff");

  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", height - margin.bottom / 2)
    .attr("font-size", "20px")
    .attr("font-family", "Inter")
    .attr("font-weight", "bold")
    .attr("fill", "#ffffff")
    .text(xLabel);

  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2 + 40)
    .attr("y", -margin.left + 40)
    .attr("font-size", "20px")
    .attr("font-family", "Inter")
    .attr("font-weight", "bold")
    .attr("fill", "#ffffff")
    .text(yLabel);
}

// ─────────────────────────────────────────────────────────────────────────────
// Year-to-year progress (bar chart)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchYearlyStats() {
  const response = await fetch("/api/yearly-stats");
  const data = await response.json();
  window.yearlyStats = data;

  renderYearlyChart("All", "goals_per_game");

  document.getElementById("yearly-type-menu").addEventListener("change", () => {
    renderYearlyChart(
      document.getElementById("yearly-type-menu").value,
      document.getElementById("yearly-stat-menu").value
    );
  });

  document.getElementById("yearly-stat-menu").addEventListener("change", () => {
    renderYearlyChart(
      document.getElementById("yearly-type-menu").value,
      document.getElementById("yearly-stat-menu").value
    );
  });
}

function renderYearlyChart(gameType, statKey) {
  const data = (window.yearlyStats || {})[gameType] || [];
  d3.select("#yearly-stats-chart").selectAll("*").remove();

  if (!data.length) {
    d3.select("#yearly-stats-chart")
      .append("p")
      .style("text-align", "center")
      .style("padding", "20px")
      .style("color", "#aaa")
      .text("No data available for this selection.");
    return;
  }

  try {
  const { width, height } = responsiveChartSize();
  const margin = { top: 30, right: 30, bottom: 60, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const yLabelMap = {
    goals_per_game: "Goals Per Game",
    goals: "Goals",
    games_played: "Games Played",
  };

  const svg = d3
    .select("#yearly-stats-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.year))
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[statKey]) * 1.2 || 1])
    .nice()
    .range([innerHeight, 0]);

  svg
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg.append("g").call(d3.axisLeft(y));

  svg
    .append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""))
    .selectAll("line")
    .attr("stroke", "#ccc")
    .attr("stroke-dasharray", "4 2")
    .attr("stroke-opacity", 0.3);

  svg
    .selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.year))
    .attr("y", (d) => y(d[statKey]))
    .attr("width", x.bandwidth())
    .attr("height", (d) => innerHeight - y(d[statKey]))
    .attr("fill", "#3ecf8e")
    .attr("rx", 3);

  // Value labels on top of each bar
  svg
    .selectAll(".bar-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", (d) => x(d.year) + x.bandwidth() / 2)
    .attr("y", (d) => y(d[statKey]) - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#ffffff")
    .attr("font-weight", "bold")
    .text((d) => {
      const val = d[statKey];
      return statKey === "goals_per_game" ? val.toFixed(2) : val;
    });

  // Y-axis label
  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -margin.left + 20)
    .attr("font-size", "16px")
    .attr("font-family", "Inter")
    .attr("font-weight", "bold")
    .attr("fill", "#ffffff")
    .text(yLabelMap[statKey] || statKey);

  } catch (err) {
    console.error("renderYearlyChart error:", err);
    d3.select("#yearly-stats-chart")
      .append("p")
      .style("text-align", "center")
      .style("padding", "20px")
      .style("color", "#ff6b6b")
      .text("Chart render error — check console.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
function responsiveChartSize() {
  const outer = document.getElementById("outer-flex-container");
  // clientWidth on the outer container is unaffected by any SVG children
  const available = outer ? outer.clientWidth : window.innerWidth - 32;
  // Subtract box borders (5px each side) and cap at 800
  const width = Math.min(Math.max(available - 10, 280), 800);
  const height = width < 330 ? 350 : Math.round(width / 2);
  return { width, height };
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

window.addEventListener(
  "resize",
  debounce(() => {
    const gameType = document.querySelector("#second-dropdown-menu").value;
    const statType = document.querySelector("#stat-select-menu").value;
    renderStatGraph(gameType, statType);

    const yearlyType = document.getElementById("yearly-type-menu").value;
    const yearlyStat = document.getElementById("yearly-stat-menu").value;
    renderYearlyChart(yearlyType, yearlyStat);
  }, 100)
);

// ─────────────────────────────────────────────────────────────────────────────
// Recent Form (last 10 matches)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRecentForm() {
  const response = await fetch("/api/recent-form");
  const data = await response.json();
  renderRecentForm(data);
}

function renderRecentForm(data) {
  const { matches, stats } = data;

  const typeClass = {
    "11v11": "type-11v11",
    "7v7": "type-7v7",
    "5v5": "type-5v5",
  };
  const outcomeClass = { 1: "win", 0: "draw", "-1": "loss" };
  const outcomeLetter = { 1: "W", 0: "D", "-1": "L" };

  const row = document.getElementById("form-squares-row");
  row.innerHTML = "";

  matches.forEach((m) => {
    const sq = document.createElement("div");
    const oc = m.outcome !== null ? String(m.outcome) : null;
    sq.className = [
      "form-square",
      typeClass[m.game_type] || "type-other",
      oc !== null ? outcomeClass[oc] || "unknown" : "unknown",
    ].join(" ");

    sq.textContent = oc !== null ? outcomeLetter[oc] || "?" : "?";

    const dateStr = new Date(m.date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    sq.title = `${dateStr} · ${m.game_type} · G: ${m.goals} · A: ${m.assists}`;

    row.appendChild(sq);
  });

  const statsDefs = [
    { label: "GP", title: "Games Played", value: stats.games },
    { label: "W", title: "Wins", value: stats.wins },
    { label: "D", title: "Draws", value: stats.draws },
    { label: "L", title: "Losses", value: stats.losses },
    { label: "Win%", title: "Win Rate", value: stats.win_rate + "%" },
    { label: "G", title: "Goals", value: stats.goals },
    { label: "GpG", title: "Goals per Game", value: stats.goals_per_game.toFixed(2) },
    { label: "A", title: "Assists", value: stats.assists },
    { label: "ApG", title: "Assists per Game", value: stats.assists_per_game.toFixed(2) },
  ];

  const statsRow = document.getElementById("recent-form-stats");
  statsRow.innerHTML = "";
  statsDefs.forEach(({ label, title, value }) => {
    const metric = document.createElement("div");
    metric.className = "metric";
    metric.innerHTML = `
      <p class="metric-label" title="${title}">${label}</p>
      <div class="metric-box box"><p class="metric-value">${value}</p></div>
    `;
    statsRow.appendChild(metric);
  });

  const fmt = (iso) =>
    new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const dateRange = document.getElementById("recent-form-date-range");
  if (stats.date_from && stats.date_to) {
    dateRange.textContent = `${fmt(stats.date_to)} – ${fmt(stats.date_from)}`;
  }
}

fetchData();
fetchGameStats();
fetchYearlyStats();
fetchRecentForm();
