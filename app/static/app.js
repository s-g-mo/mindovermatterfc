async function fetchData() {
  const response = await fetch("/api/data");
  const data = await response.json();
  console.log("Data fetched:", data);

  // Store data globally to access later in event handlers
  window.dashboardData = data;

  // Set dropdown to "All" by default and display metrics
  document.querySelector("#first-dropdown-menu").value = "All";
  updateMetrics("All");

  // Render the pie chart with default data (show distribution across all game types)
  const chartData = data
    .filter((d) => d.game_type !== "All") // Exclude "All" for the pie chart
    .map((d) => ({ label: d.game_type, value: d.games_played }));
  renderPieChart(chartData, "All");

  // Add event listener to dropdown to update metrics and highlight the pie chart
  document
    .querySelector("#first-dropdown-menu")
    .addEventListener("change", function (event) {
      const selectedType = event.target.value;
      console.log("Dropdown changed to:", selectedType);
      updateMetrics(selectedType);

      // Update pie chart, excluding "All" data from segments
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
    document.getElementById("games-played").innerText =
      selectedData.games_played;
    document.getElementById("goals-scored").innerText = selectedData.goals;
    document.getElementById("goals-per-game").innerText =
      selectedData.goals_per_game.toFixed(2);
    document.getElementById("assists").innerText = selectedData.assists;
    document.getElementById("assists-per-game").innerText =
      selectedData.assists_per_game.toFixed(2);
  } else {
    // If "All" or undefined data, reset to defaults or "--"
    document.getElementById("games-played").innerText = "--";
    document.getElementById("goals-scored").innerText = "--";
    document.getElementById("goals-per-game").innerText = "--";
    document.getElementById("assists").innerText = "--";
    document.getElementById("assists-per-game").innerText = "--";
  }
}

function renderPieChart(data, selectedGameType = "All") {
  console.log("Rendering pie chart for selected type:", selectedGameType);
  const width = 220;
  const height = 220;
  const radius = Math.min(width, height) / 2;

  const color = d3.scaleOrdinal(["#3ecf8e", "#4b9cd3", "#a78bfa"]);

  const arc = d3
    .arc()
    .innerRadius(radius * 0.3)
    .outerRadius(radius);

  const pie = d3
    .pie()
    .value((d) => d.value)
    .sort(null);

  // Clear previous chart if it exists
  d3.select("#doughnut-chart").selectAll("*").remove();

  const svg = d3
    .select("#doughnut-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  // Define glow filter
  const defs = svg.append("defs");
  const filter = defs
    .append("filter")
    .attr("id", "glow")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%");

  filter
    .append("feGaussianBlur")
    .attr("stdDeviation", "7.5")
    .attr("result", "coloredBlur");

  const feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "coloredBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  const totalGames = data.reduce((acc, d) => acc + d.value, 0);

  // Draw arcs (segments) with optional glow for selected segment
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

  // Add labels inside each segment
  svg
    .selectAll("text")
    .data(pie(data))
    .enter()
    .append("text")
    .attr("transform", (d) => `translate(${arc.centroid(d)})`) // Position in segment center
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .style("font-family", "Graphik")
    .style("fill", "#ffffff")
    .style("font-weight", "bold")
    .text((d) => {
      const percentage = ((d.data.value / totalGames) * 100).toFixed(1);
      return `${d.data.label}: ${percentage}%`;
    });
}

async function fetchGameStats() {
  const response = await fetch("/api/game-stats");
  const data = await response.json();
  console.log("Game stats fetched", data);

  window.dashboardStats = data;

  renderStatGraph("All", "Goals_Per_Game");

  document
    .getElementById("second-dropdown-menu")
    .addEventListener("change", (event) => {
      const gameType = event.target.value;
      const selectedStat = document.getElementById("stat-select-menu").value;
      renderStatGraph(gameType, selectedStat);
    });

  document
    .getElementById("stat-select-menu")
    .addEventListener("change", (event) => {
      const selectedStat = event.target.value;
      const gameType = document.getElementById("second-dropdown-menu").value;
      renderStatGraph(gameType, selectedStat);
    });
}

function renderStatGraph(gameType, statType) {
  const viewportWidth = window.innerWidth;

  let chartWidth;
  if (viewportWidth > 1024) {
    chartWidth = 800;
  } else if (viewportWidth > 730 && viewportWidth <= 1024) {
    chartWidth = 680;
  } else if (viewportWidth >= 480 && viewportWidth <= 730) {
    chartWidth = 330;
  } else {
    chartWidth = 300;
  }

  let chartHeight;
  if (chartWidth <= 330) {
    chartHeight = 500;
  } else {
    chartHeight = chartWidth / 2;
  }

  d3.select("#game-evolution-chart").selectAll("*").remove();

  if (statType === "Goals_Per_Game") {
    renderLineGraph(
      window.dashboardStats[gameType],
      "Goals Per Game",
      "Time",
      "Goals_Per_Game",
      chartWidth,
      chartHeight
    );
  } else if (statType === "Win_Percentage") {
    renderLineGraph(
      window.dashboardStats[gameType],
      "Win %",
      "Time",
      "Win_Percentage",
      chartWidth,
      chartHeight
    );
  }
}

function renderLineGraph(
  data,
  yLabel,
  xLabel,
  statKey,
  width = 800,
  height = 400
) {
  const svgWidth = width;
  const svgHeight = height;
  const margin = { top: 20, right: 30, bottom: 70, left: 90 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  const parseDate = d3.timeParse("%Y-%m-%d");

  const parsedData = data.map((d) => ({
    ...d,
    Date: parseDate(d.Date), // Parse into a new object
    [statKey]: +d[statKey], // Ensure statKey is numeric
  }));

  d3.select("#game-evolution-chart").selectAll("*").remove();

  const svg = d3
    .select("#game-evolution-chart")
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleTime()
    .domain(d3.extent(parsedData, (d) => d.Date))
    .range([0, innerWidth]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(parsedData, (d) => d[statKey]) || 1])
    .nice()
    .range([innerHeight, 0]);

  // Add X axis
  svg
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %Y")));

  // Add Y axis
  svg.append("g").call(d3.axisLeft(y));

  // Add horizontal gridlines
  svg
    .append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""))
    .selectAll("line")
    .attr("stroke", "#ccc")
    .attr("stroke-dasharray", "4 2")
    .attr("stroke-opacity", 0.5);

  // Add the line
  svg
    .append("path")
    .datum(parsedData)
    .attr("fill", "none")
    .attr("stroke", "#4b9cd3")
    .attr("stroke-width", 2)
    .attr(
      "d",
      d3
        .line()
        .x((d) => x(d.Date))
        .y((d) => y(d[statKey]))
    );

  // Add points
  svg
    .selectAll("dot")
    .data(parsedData)
    .enter()
    .append("circle")
    .attr("r", 4)
    .attr("cx", (d) => x(d.Date))
    .attr("cy", (d) => y(d[statKey]))
    .attr("fill", "#3ecf8e");

  // Label only the last point
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

  // Add x-axis label
  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", svgWidth / 2)
    .attr("y", svgHeight - margin.bottom / 2)
    .attr("font-size", "20px")
    .attr("font-family", "Graphik")
    .attr("font-weight", "bold")
    .attr("fill", "#ffffff")
    .text(xLabel);

  // Add y-axis label
  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", `rotate(-90)`)
    .attr("x", -svgHeight / 2 + 40)
    .attr("y", -margin.left + 40)
    .attr("font-size", "20px")
    .attr("font-family", "Graphik")
    .attr("font-weight", "bold")
    .attr("fill", "#ffffff")
    .text(yLabel);
}

function updateGameStatsChart() {
  const gameType = document.querySelector("#second-dropdown-menu").value;
  const statType = document.querySelector("#stat-select-menu").value;
  renderStatGraph(gameType, statType);
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
    updateGameStatsChart();
  }, 100)
);

fetchData();
fetchGameStats();

document
  .getElementById("contact-button")
  .addEventListener("click", function () {
    const email = "steve@mindovermatterfc.com";
    navigator.clipboard
      .writeText(email)
      .then(() => {
        alert("Email address copied to clipboard: " + email);
      })
      .catch((err) => {
        alert("Failed to copy email address: " + err);
      });
  });
