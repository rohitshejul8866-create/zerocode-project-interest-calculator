(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Formatting & Math Helpers
  // ---------------------------------------------------------------------------
  function formatINR(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "\u2014";
    }
    var safeVal =
      Math.abs(value) < 1e12
        ? Math.round((value + Number.EPSILON) * 100) / 100
        : value;
    var isNegative = safeVal < 0 && Math.abs(safeVal) >= 0.005;
    var fixed = Math.abs(safeVal).toFixed(2);
    var parts = fixed.split(".");
    var intPart = parts[0];
    var decPart = parts[1];

    if (intPart.length > 3) {
      var lastThree = intPart.slice(-3);
      var rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
      intPart = rest + "," + lastThree;
    }

    return (isNegative ? "-\u20B9" : "\u20B9") + intPart + "." + decPart;
  }

  function formatCompactINR(value) {
    if (!Number.isFinite(value)) return "";
    var abs = Math.abs(value);
    var sign = value < 0 ? "-" : "";
    if (abs >= 1e7) {
      return sign + "\u20B9" + (abs / 1e7).toFixed(abs >= 1e8 ? 1 : 2).replace(/\.0+$/, "") + " Cr";
    }
    if (abs >= 1e5) {
      return sign + "\u20B9" + (abs / 1e5).toFixed(abs >= 1e6 ? 1 : 2).replace(/\.0+$/, "") + " L";
    }
    var rounded = Math.round(abs);
    var str = String(rounded);
    if (str.length > 3) {
      var lastThree = str.slice(-3);
      var rest = str.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
      str = rest + "," + lastThree;
    }
    return sign + "\u20B9" + str;
  }

  function calcSimple(p, r, t) {
    return p + (p * r * t) / 100;
  }

  function calcCompound(p, r, t, n) {
    return p * Math.pow(1 + r / (100 * n), n * t);
  }

  function calcReal(amount, inflation, t) {
    if (inflation <= 0) return amount;
    return amount / Math.pow(1 + inflation / 100, t);
  }

  function calcGoalYearsCompound(start, target, rate, n) {
    return Math.log(target / start) / (n * Math.log(1 + rate / (100 * n)));
  }

  function calcGoalYearsSimple(start, target, rate) {
    return (target - start) / ((start * rate) / 100);
  }

  function parseRequiredPositive(inputEl, label) {
    if (inputEl.validity && inputEl.validity.badInput) {
      return { valid: false, error: "Enter a valid number for " + label + "." };
    }
    var trimmed = String(inputEl.value).trim();
    if (trimmed === "") {
      return { valid: false, error: "Please enter " + label + "." };
    }
    var num = Number(trimmed);
    if (!Number.isFinite(num)) {
      return { valid: false, error: "Enter a valid number for " + label + "." };
    }
    if (num <= 0) {
      return {
        valid: false,
        error: label.charAt(0).toUpperCase() + label.slice(1) + " must be greater than 0."
      };
    }
    return { valid: true, value: num, error: "" };
  }

  function parseOptionalNonNegative(inputEl, label) {
    if (inputEl.validity && inputEl.validity.badInput) {
      return { valid: false, error: "Enter a valid number for " + label + "." };
    }
    var trimmed = String(inputEl.value).trim();
    if (trimmed === "") {
      return { valid: true, value: 0, error: "", isEmpty: true };
    }
    var num = Number(trimmed);
    if (!Number.isFinite(num)) {
      return { valid: false, error: "Enter a valid number for " + label + "." };
    }
    if (num < 0) {
      return {
        valid: false,
        error: label.charAt(0).toUpperCase() + label.slice(1) + " cannot be negative."
      };
    }
    return { valid: true, value: num, error: "", isEmpty: false };
  }

  function setFieldError(inputEl, errorEl, errorMessage) {
    var wrap = inputEl.closest(".input-wrap");
    if (errorMessage) {
      errorEl.textContent = errorMessage;
      inputEl.setAttribute("aria-invalid", "true");
      if (wrap) wrap.classList.add("has-error");
    } else {
      errorEl.textContent = "";
      inputEl.removeAttribute("aria-invalid");
      if (wrap) wrap.classList.remove("has-error");
    }
  }

  // ---------------------------------------------------------------------------
  // DOM References
  // ---------------------------------------------------------------------------
  var tabCompare = document.getElementById("tab-compare");
  var tabCalculator = document.getElementById("tab-calculator");
  var tabGoal = document.getElementById("tab-goal");
  var panelCompare = document.getElementById("panel-compare");
  var panelCalculator = document.getElementById("panel-calculator");
  var panelGoal = document.getElementById("panel-goal");
  var themeToggleBtn = document.getElementById("theme-toggle");
  var resetBtn = document.getElementById("reset-btn");
  var brandLink = document.getElementById("brand-link");

  // Compare inputs
  var cmpPrincipal = document.getElementById("cmp-principal");
  var cmpRate = document.getElementById("cmp-rate");
  var cmpYears = document.getElementById("cmp-years");
  var cmpYearsSlider = document.getElementById("cmp-years-slider");
  var cmpInflation = document.getElementById("cmp-inflation");

  // Compare errors
  var cmpPrincipalErr = document.getElementById("cmp-principal-error");
  var cmpRateErr = document.getElementById("cmp-rate-error");
  var cmpYearsErr = document.getElementById("cmp-years-error");
  var cmpInflationErr = document.getElementById("cmp-inflation-error");

  // Compare outputs
  var cmpSimpleFinal = document.getElementById("cmp-simple-final");
  var cmpSimpleInterest = document.getElementById("cmp-simple-interest");
  var cmpSimpleReal = document.getElementById("cmp-simple-real");
  var cmpCompoundFinal = document.getElementById("cmp-compound-final");
  var cmpCompoundInterest = document.getElementById("cmp-compound-interest");
  var cmpCompoundReal = document.getElementById("cmp-compound-real");
  var cmpDifference = document.getElementById("cmp-difference");
  var cmpDiffPct = document.getElementById("cmp-diff-pct");
  var cmpDiffReal = document.getElementById("cmp-diff-real");

  // Chart elements
  var chartWrap = document.getElementById("chart-wrap");
  var chartCanvas = document.getElementById("compare-chart");
  var chartTooltip = document.getElementById("chart-tooltip");
  var chartEmpty = document.getElementById("chart-empty");
  var chartSubtitle = document.getElementById("chart-subtitle");

  // Calculator inputs
  var calcPrincipal = document.getElementById("calc-principal");
  var calcRate = document.getElementById("calc-rate");
  var calcYears = document.getElementById("calc-years");
  var calcTypeSimpleBtn = document.getElementById("type-simple");
  var calcTypeCompoundBtn = document.getElementById("type-compound");
  var calcFrequency = document.getElementById("calc-frequency");
  var calcFrequencyHint = document.getElementById("calc-frequency-hint");
  var calcInflation = document.getElementById("calc-inflation");

  // Calculator errors
  var calcPrincipalErr = document.getElementById("calc-principal-error");
  var calcRateErr = document.getElementById("calc-rate-error");
  var calcYearsErr = document.getElementById("calc-years-error");
  var calcInflationErr = document.getElementById("calc-inflation-error");

  // Calculator outputs
  var calcConfigLine = document.getElementById("calc-config-line");
  var calcInterestEarned = document.getElementById("calc-interest-earned");
  var calcInterestShare = document.getElementById("calc-interest-share");
  var calcFinalAmount = document.getElementById("calc-final-amount");
  var calcPrincipalEcho = document.getElementById("calc-principal-echo");
  var calcRealAmount = document.getElementById("calc-real-amount");
  var calcRealNote = document.getElementById("calc-real-note");
  var calcRatioPrincipal = document.getElementById("calc-ratio-principal");
  var calcRatioInterest = document.getElementById("calc-ratio-interest");
  var calcPrincipalPct = document.getElementById("calc-principal-pct");
  var calcInterestPct = document.getElementById("calc-interest-pct");
  var calcComparisonBody = document.getElementById("calc-comparison-body");

  // Goal inputs
  var goalStart = document.getElementById("goal-start");
  var goalTarget = document.getElementById("goal-target");
  var goalRate = document.getElementById("goal-rate");
  var goalFrequency = document.getElementById("goal-frequency");
  var goalInflation = document.getElementById("goal-inflation");

  // Goal errors
  var goalStartErr = document.getElementById("goal-start-error");
  var goalTargetErr = document.getElementById("goal-target-error");
  var goalRateErr = document.getElementById("goal-rate-error");
  var goalInflationErr = document.getElementById("goal-inflation-error");

  // Goal outputs
  var goalYears = document.getElementById("goal-years");
  var goalMonths = document.getElementById("goal-months");
  var goalFreqLabel = document.getElementById("goal-freq-label");
  var goalGain = document.getElementById("goal-gain");
  var goalMultiplier = document.getElementById("goal-multiplier");
  var goalRealTarget = document.getElementById("goal-real-target");
  var goalSimpleYears = document.getElementById("goal-simple-years");
  var goalTimeSaved = document.getElementById("goal-time-saved");
  var goalComparisonBody = document.getElementById("goal-comparison-body");

  var activeTab = "compare";
  var calcInterestType = "compound";

  // Chart state for hover interactions & redraws
  var chartState = {
    valid: true,
    points: [],
    hoverIndex: -1,
    geometry: null
  };

  // ---------------------------------------------------------------------------
  // Theme Switching (Light Pink Default / Dark Mode)
  // ---------------------------------------------------------------------------
  function isDarkMode() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function applyTheme(theme) {
    var dark = theme === "dark";
    if (dark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    if (themeToggleBtn) {
      themeToggleBtn.textContent = dark ? "Light mode" : "Dark mode";
      themeToggleBtn.setAttribute("aria-pressed", dark ? "true" : "false");
      themeToggleBtn.setAttribute(
        "aria-label",
        dark ? "Switch to light mode" : "Switch to dark mode"
      );
    }
    try {
      window.localStorage.setItem("interest-studio-theme", dark ? "dark" : "light");
    } catch (e) {
      // Ignore storage errors under restricted file:// contexts
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", function () {
      applyTheme(isDarkMode() ? "light" : "dark");
      if (activeTab === "compare") {
        drawChart();
      }
    });
  }

  try {
    var savedTheme = window.localStorage.getItem("interest-studio-theme");
    if (savedTheme === "dark") {
      applyTheme("dark");
    } else {
      applyTheme("light");
    }
  } catch (e) {
    applyTheme("light");
  }

  // ---------------------------------------------------------------------------
  // Tab Switching
  // ---------------------------------------------------------------------------
  function switchTab(tabName) {
    activeTab = tabName;
    var isCompare = tabName === "compare";
    var isCalc = tabName === "calculator";
    var isGoal = tabName === "goal";

    tabCompare.classList.toggle("is-active", isCompare);
    tabCompare.setAttribute("aria-selected", isCompare ? "true" : "false");
    panelCompare.hidden = !isCompare;

    tabCalculator.classList.toggle("is-active", isCalc);
    tabCalculator.setAttribute("aria-selected", isCalc ? "true" : "false");
    panelCalculator.hidden = !isCalc;

    tabGoal.classList.toggle("is-active", isGoal);
    tabGoal.setAttribute("aria-selected", isGoal ? "true" : "false");
    panelGoal.hidden = !isGoal;

    if (isCompare) {
      drawChart();
    }
  }

  tabCompare.addEventListener("click", function () {
    switchTab("compare");
  });

  tabCalculator.addEventListener("click", function () {
    switchTab("calculator");
  });

  tabGoal.addEventListener("click", function () {
    switchTab("goal");
  });

  brandLink.addEventListener("click", function (e) {
    e.preventDefault();
    switchTab("compare");
  });

  // ---------------------------------------------------------------------------
  // Tab 1: Compare Logic + Slider + Canvas Chart
  // ---------------------------------------------------------------------------
  function updateSliderVisual(val) {
    var clamped = Math.max(1, Math.min(30, Number(val) || 1));
    var pct = ((clamped - 1) / 29) * 100;
    cmpYearsSlider.style.setProperty("--fill-pct", pct.toFixed(2) + "%");
  }

  function buildChartPoints(p, r, t) {
    var points = [];
    var wholeYears = Math.floor(t);
    for (var yr = 0; yr <= wholeYears; yr += 1) {
      points.push({
        year: yr,
        simple: calcSimple(p, r, yr),
        compound: calcCompound(p, r, yr, 1)
      });
    }
    if (t - wholeYears > 1e-6) {
      points.push({
        year: t,
        simple: calcSimple(p, r, t),
        compound: calcCompound(p, r, t, 1)
      });
    }
    return points;
  }

  function updateCompare() {
    var pRes = parseRequiredPositive(cmpPrincipal, "principal amount");
    var rRes = parseRequiredPositive(cmpRate, "interest rate");
    var infRes = parseOptionalNonNegative(cmpInflation, "inflation rate");

    var rawYears = String(cmpYears.value).trim();
    var yRes;
    if (cmpYears.validity && cmpYears.validity.badInput) {
      yRes = { valid: false, error: "Enter a valid number of years (1 to 30)." };
    } else if (rawYears === "") {
      yRes = { valid: false, error: "Please enter years between 1 and 30." };
    } else {
      var yNum = Number(rawYears);
      if (!Number.isFinite(yNum)) {
        yRes = { valid: false, error: "Enter a valid number of years." };
      } else if (yNum <= 0) {
        yRes = { valid: false, error: "Years must be at least 1." };
      } else if (yNum > 30) {
        yRes = { valid: false, error: "Years cannot exceed 30." };
      } else {
        yRes = { valid: true, value: yNum, error: "" };
      }
    }

    setFieldError(cmpPrincipal, cmpPrincipalErr, pRes.error);
    setFieldError(cmpRate, cmpRateErr, rRes.error);
    setFieldError(cmpYears, cmpYearsErr, yRes.error);
    setFieldError(cmpInflation, cmpInflationErr, infRes.error);

    if (yRes.valid) {
      var sliderInt = Math.max(1, Math.min(30, Math.round(yRes.value)));
      if (Number(cmpYearsSlider.value) !== sliderInt) {
        cmpYearsSlider.value = String(sliderInt);
      }
      updateSliderVisual(sliderInt);
    }

    if (!pRes.valid || !rRes.valid || !yRes.valid || !infRes.valid) {
      cmpSimpleFinal.textContent = "\u2014";
      cmpSimpleInterest.textContent = "\u2014";
      cmpSimpleReal.textContent = "\u2014";
      cmpCompoundFinal.textContent = "\u2014";
      cmpCompoundInterest.textContent = "\u2014";
      cmpCompoundReal.textContent = "\u2014";
      cmpDifference.textContent = "\u2014";
      cmpDiffPct.textContent = "\u2014";
      cmpDiffReal.textContent = "\u2014";
      chartSubtitle.textContent = "Awaiting valid inputs";

      chartState.valid = false;
      chartState.points = [];
      chartState.hoverIndex = -1;
      chartTooltip.hidden = true;
      chartEmpty.hidden = false;
      drawChart();
      return;
    }

    var p = pRes.value;
    var r = rRes.value;
    var t = yRes.value;
    var inf = infRes.value;

    var simpleFinal = calcSimple(p, r, t);
    var compoundFinal = calcCompound(p, r, t, 1);
    var diff = compoundFinal - simpleFinal;
    var diffPct = simpleFinal > 0 ? (diff / simpleFinal) * 100 : 0;

    var simpleReal = calcReal(simpleFinal, inf, t);
    var compoundReal = calcReal(compoundFinal, inf, t);
    var diffReal = compoundReal - simpleReal;

    cmpSimpleFinal.textContent = formatINR(simpleFinal);
    cmpSimpleInterest.textContent = formatINR(simpleFinal - p);
    cmpSimpleReal.textContent = formatINR(simpleReal);

    cmpCompoundFinal.textContent = formatINR(compoundFinal);
    cmpCompoundInterest.textContent = formatINR(compoundFinal - p);
    cmpCompoundReal.textContent = formatINR(compoundReal);

    cmpDifference.textContent = formatINR(diff);
    cmpDiffPct.textContent = (diffPct >= 0 ? "+" : "") + diffPct.toFixed(2) + "%";
    cmpDiffReal.textContent = formatINR(diffReal);

    var yearLabel = t === 1 ? "1 year" : t + " years";
    chartSubtitle.textContent =
      "Year-by-year trajectory over " + yearLabel + (inf > 0 ? " (nominal amounts)" : "");

    chartState.valid = true;
    chartState.points = buildChartPoints(p, r, t);
    if (chartState.hoverIndex >= chartState.points.length) {
      chartState.hoverIndex = -1;
      chartTooltip.hidden = true;
    }
    chartEmpty.hidden = true;
    drawChart();
  }

  function drawChart() {
    var width = chartWrap.clientWidth;
    var height = chartWrap.clientHeight;
    if (width <= 0 || height <= 0) return;

    var dpr = window.devicePixelRatio || 1;
    var targetW = Math.round(width * dpr);
    var targetH = Math.round(height * dpr);
    if (chartCanvas.width !== targetW || chartCanvas.height !== targetH) {
      chartCanvas.width = targetW;
      chartCanvas.height = targetH;
    }

    var ctx = chartCanvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!chartState.valid || chartState.points.length < 2) {
      chartState.geometry = null;
      return;
    }

    var points = chartState.points;
    var minVal = points[0].simple;
    var maxVal = points[0].compound;
    for (var i = 0; i < points.length; i += 1) {
      if (points[i].simple < minVal) minVal = points[i].simple;
      if (points[i].compound < minVal) minVal = points[i].compound;
      if (points[i].simple > maxVal) maxVal = points[i].simple;
      if (points[i].compound > maxVal) maxVal = points[i].compound;
    }

    if (maxVal <= minVal) {
      maxVal = minVal + 1;
    }

    var range = maxVal - minVal;
    var yMin = Math.max(0, minVal - range * 0.06);
    var yMax = maxVal + range * 0.1;

    ctx.font = '11.5px "SF Mono", ui-monospace, Menlo, Consolas, monospace';
    var yTickCount = 4;
    var yLabels = [];
    var maxLabelWidth = 0;
    for (var g = 0; g <= yTickCount; g += 1) {
      var tickVal = yMin + ((yMax - yMin) * g) / yTickCount;
      var label = formatCompactINR(tickVal);
      yLabels.push({ val: tickVal, label: label });
      var measured = ctx.measureText(label).width;
      if (measured > maxLabelWidth) maxLabelWidth = measured;
    }

    var padLeft = Math.max(62, Math.ceil(maxLabelWidth) + 16);
    var padRight = 20;
    var padTop = 16;
    var padBottom = 32;
    var plotW = Math.max(40, width - padLeft - padRight);
    var plotH = Math.max(40, height - padTop - padBottom);

    var maxYear = points[points.length - 1].year;
    if (maxYear <= 0) maxYear = 1;

    function xForYear(yr) {
      return padLeft + (yr / maxYear) * plotW;
    }

    function yForVal(val) {
      return padTop + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
    }

    chartState.geometry = {
      padLeft: padLeft,
      padRight: padRight,
      padTop: padTop,
      padBottom: padBottom,
      plotW: plotW,
      plotH: plotH,
      maxYear: maxYear,
      yMin: yMin,
      yMax: yMax,
      xForYear: xForYear,
      yForVal: yForVal
    };

    var dark = isDarkMode();
    var palette = dark
      ? {
          baseGrid: "#443554",
          grid: "#282033",
          axisText: "#b9a6b7",
          compoundLine: "#f472b6",
          areaTop: "rgba(244, 114, 182, 0.24)",
          areaBottom: "rgba(244, 114, 182, 0.01)",
          simpleLine: "#fbbf24",
          crosshair: "#8c768a",
          dotFill: "#171420"
        }
      : {
          baseGrid: "#e3b7cc",
          grid: "#f5dce8",
          axisText: "#7a5b6e",
          compoundLine: "#be185d",
          areaTop: "rgba(190, 24, 93, 0.16)",
          areaBottom: "rgba(190, 24, 93, 0.01)",
          simpleLine: "#b45309",
          crosshair: "#9e7c90",
          dotFill: "#ffffff"
        };

    // Horizontal gridlines & Y-axis labels
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (var j = 0; j < yLabels.length; j += 1) {
      var yPos = yForVal(yLabels[j].val);
      ctx.beginPath();
      ctx.strokeStyle = j === 0 ? palette.baseGrid : palette.grid;
      ctx.lineWidth = 1;
      ctx.moveTo(padLeft, Math.round(yPos) + 0.5);
      ctx.lineTo(padLeft + plotW, Math.round(yPos) + 0.5);
      ctx.stroke();

      ctx.fillStyle = palette.axisText;
      ctx.fillText(yLabels[j].label, padLeft - 10, yPos);
    }

    // X-axis tick labels
    var xStep = maxYear <= 10 ? 1 : maxYear <= 20 ? 2 : 5;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = palette.axisText;
    ctx.font = '11.5px "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif';

    for (var yr = 0; yr <= Math.floor(maxYear); yr += xStep) {
      var xPos = xForYear(yr);
      ctx.fillText("Yr " + yr, xPos, padTop + plotH + 10);
    }
    var lastWhole = Math.floor(maxYear);
    if (lastWhole % xStep !== 0 && maxYear - (lastWhole - (lastWhole % xStep)) >= xStep * 0.55) {
      ctx.fillText("Yr " + maxYear, xForYear(maxYear), padTop + plotH + 10);
    }

    // Compound area fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xForYear(points[0].year), padTop + plotH);
    for (var k = 0; k < points.length; k += 1) {
      ctx.lineTo(xForYear(points[k].year), yForVal(points[k].compound));
    }
    ctx.lineTo(xForYear(points[points.length - 1].year), padTop + plotH);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    grad.addColorStop(0, palette.areaTop);
    grad.addColorStop(1, palette.areaBottom);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Simple interest dashed line
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = palette.simpleLine;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (var s = 0; s < points.length; s += 1) {
      var sx = xForYear(points[s].year);
      var sy = yForVal(points[s].simple);
      if (s === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();

    // Compound interest solid line
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = palette.compoundLine;
    ctx.lineWidth = 2.75;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (var c = 0; c < points.length; c += 1) {
      var cx = xForYear(points[c].year);
      var cy = yForVal(points[c].compound);
      if (c === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.restore();

    // Data point dots when <= 16 points
    if (points.length <= 16) {
      for (var d = 0; d < points.length; d += 1) {
        var dx = xForYear(points[d].year);
        drawDot(ctx, dx, yForVal(points[d].simple), palette.simpleLine, palette.dotFill, 3.2);
        drawDot(ctx, dx, yForVal(points[d].compound), palette.compoundLine, palette.dotFill, 3.5);
      }
    }

    // Active hover crosshair & highlighted markers
    if (chartState.hoverIndex >= 0 && chartState.hoverIndex < points.length) {
      var active = points[chartState.hoverIndex];
      var hx = xForYear(active.year);

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = palette.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, padTop + plotH);
      ctx.stroke();
      ctx.restore();

      drawDot(ctx, hx, yForVal(active.simple), palette.simpleLine, palette.dotFill, 5.5);
      drawDot(ctx, hx, yForVal(active.compound), palette.compoundLine, palette.dotFill, 5.5);
    }
  }

  function drawDot(ctx, x, y, color, fillColor, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function handleChartPointer(clientX, clientY) {
    if (!chartState.valid || !chartState.geometry || chartState.points.length === 0) {
      return;
    }
    var rect = chartCanvas.getBoundingClientRect();
    var relX = clientX - rect.left;
    var relY = clientY - rect.top;
    var geo = chartState.geometry;

    if (
      relX < geo.padLeft - 10 ||
      relX > geo.padLeft + geo.plotW + 10 ||
      relY < geo.padTop - 10 ||
      relY > geo.padTop + geo.plotH + 10
    ) {
      clearChartHover();
      return;
    }

    var bestIdx = 0;
    var bestDist = Infinity;
    for (var i = 0; i < chartState.points.length; i += 1) {
      var px = geo.xForYear(chartState.points[i].year);
      var dist = Math.abs(px - relX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    chartState.hoverIndex = bestIdx;
    drawChart();

    var pt = chartState.points[bestIdx];
    var diff = pt.compound - pt.simple;
    var yrDisplay = Number.isInteger(pt.year) ? pt.year : pt.year.toFixed(2);

    chartTooltip.innerHTML =
      '<div class="chart-tooltip-title">Year ' + yrDisplay + "</div>" +
      '<div class="chart-tooltip-row"><span>Compound</span><strong>' + formatINR(pt.compound) + "</strong></div>" +
      '<div class="chart-tooltip-row"><span>Simple</span><strong>' + formatINR(pt.simple) + "</strong></div>" +
      '<div class="chart-tooltip-row"><span>Difference</span><strong>' + formatINR(diff) + "</strong></div>";

    chartTooltip.hidden = false;

    var tipW = chartTooltip.offsetWidth || 190;
    var tipH = chartTooltip.offsetHeight || 96;
    var pointX = geo.xForYear(pt.year);
    var pointY = Math.min(geo.yForVal(pt.compound), geo.yForVal(pt.simple));

    var left = pointX + 14;
    if (left + tipW > rect.width - 8) {
      left = pointX - tipW - 14;
    }
    if (left < 8) left = 8;

    var top = pointY - tipH / 2;
    if (top < 8) top = 8;
    if (top + tipH > rect.height - 8) top = rect.height - tipH - 8;

    chartTooltip.style.left = Math.round(left) + "px";
    chartTooltip.style.top = Math.round(top) + "px";
  }

  function clearChartHover() {
    if (chartState.hoverIndex !== -1) {
      chartState.hoverIndex = -1;
      chartTooltip.hidden = true;
      drawChart();
    }
  }

  chartCanvas.addEventListener("mousemove", function (e) {
    handleChartPointer(e.clientX, e.clientY);
  });

  chartCanvas.addEventListener("mouseleave", clearChartHover);

  chartCanvas.addEventListener(
    "touchmove",
    function (e) {
      if (e.touches && e.touches.length > 0) {
        handleChartPointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: true }
  );

  chartCanvas.addEventListener("touchend", clearChartHover);

  // Sync slider <-> number input on Compare tab
  cmpYearsSlider.addEventListener("input", function () {
    cmpYears.value = cmpYearsSlider.value;
    updateSliderVisual(cmpYearsSlider.value);
    updateCompare();
  });

  cmpYears.addEventListener("input", updateCompare);
  cmpPrincipal.addEventListener("input", updateCompare);
  cmpRate.addEventListener("input", updateCompare);
  cmpInflation.addEventListener("input", updateCompare);

  // ---------------------------------------------------------------------------
  // Tab 2: Calculator Logic
  // ---------------------------------------------------------------------------
  function setCalcType(type) {
    calcInterestType = type;
    var isCompound = type === "compound";

    calcTypeSimpleBtn.classList.toggle("is-active", !isCompound);
    calcTypeSimpleBtn.setAttribute("aria-checked", !isCompound ? "true" : "false");

    calcTypeCompoundBtn.classList.toggle("is-active", isCompound);
    calcTypeCompoundBtn.setAttribute("aria-checked", isCompound ? "true" : "false");

    calcFrequency.disabled = !isCompound;
    calcFrequencyHint.textContent = isCompound
      ? "Applies to compound interest calculations."
      : "Compounding frequency is inactive for Simple interest.";

    updateCalculator();
  }

  calcTypeSimpleBtn.addEventListener("click", function () {
    setCalcType("simple");
  });

  calcTypeCompoundBtn.addEventListener("click", function () {
    setCalcType("compound");
  });

  function updateCalculator() {
    var pRes = parseRequiredPositive(calcPrincipal, "principal amount");
    var rRes = parseRequiredPositive(calcRate, "interest rate");
    var yRes = parseRequiredPositive(calcYears, "time period");
    var infRes = parseOptionalNonNegative(calcInflation, "inflation rate");

    if (yRes.valid && yRes.value > 100) {
      yRes = { valid: false, error: "Years cannot exceed 100." };
    }

    setFieldError(calcPrincipal, calcPrincipalErr, pRes.error);
    setFieldError(calcRate, calcRateErr, rRes.error);
    setFieldError(calcYears, calcYearsErr, yRes.error);
    setFieldError(calcInflation, calcInflationErr, infRes.error);

    var n = Number(calcFrequency.value) || 1;
    var freqNames = {
      1: "Yearly",
      2: "Half-yearly",
      4: "Quarterly",
      12: "Monthly"
    };

    var rows = calcComparisonBody.querySelectorAll("tr");
    for (var rIdx = 0; rIdx < rows.length; rIdx += 1) {
      var methodAttr = rows[rIdx].getAttribute("data-method");
      var shouldSelect =
        (calcInterestType === "simple" && methodAttr === "simple") ||
        (calcInterestType === "compound" && methodAttr === String(n));
      rows[rIdx].classList.toggle("is-selected", shouldSelect);
    }

    if (!pRes.valid || !rRes.valid || !yRes.valid || !infRes.valid) {
      calcConfigLine.textContent = "Awaiting valid inputs";
      calcInterestEarned.textContent = "\u2014";
      calcInterestShare.textContent = "\u2014";
      calcFinalAmount.textContent = "\u2014";
      calcPrincipalEcho.textContent = "\u2014";
      calcRealAmount.textContent = "\u2014";
      calcRealNote.textContent = "\u2014";
      calcRatioPrincipal.style.width = "100%";
      calcRatioInterest.style.width = "0%";
      calcPrincipalPct.textContent = "\u2014";
      calcInterestPct.textContent = "\u2014";

      var allIds = ["simple", "1", "2", "4", "12"];
      for (var m = 0; m < allIds.length; m += 1) {
        document.getElementById("row-" + allIds[m] + "-int").textContent = "\u2014";
        document.getElementById("row-" + allIds[m] + "-final").textContent = "\u2014";
        document.getElementById("row-" + allIds[m] + "-real").textContent = "\u2014";
      }
      return;
    }

    var p = pRes.value;
    var r = rRes.value;
    var t = yRes.value;
    var inf = infRes.value;

    var finalAmount =
      calcInterestType === "simple"
        ? calcSimple(p, r, t)
        : calcCompound(p, r, t, n);

    var interestEarned = finalAmount - p;
    var realAmount = calcReal(finalAmount, inf, t);

    var yrText = t === 1 ? "1 year" : t + " years";
    calcConfigLine.textContent =
      (calcInterestType === "simple"
        ? "Simple Interest"
        : "Compound \u00B7 " + freqNames[n]) +
      " \u00B7 " +
      yrText;

    calcInterestEarned.textContent = formatINR(interestEarned);
    calcFinalAmount.textContent = formatINR(finalAmount);
    calcRealAmount.textContent = formatINR(realAmount);
    calcPrincipalEcho.textContent = "From " + formatINR(p) + " principal";
    calcRealNote.textContent =
      inf > 0
        ? "At " + inf + "% annual inflation"
        : "At 0% annual inflation";

    var pShare = finalAmount > 0 ? (p / finalAmount) * 100 : 100;
    var iShare = finalAmount > 0 ? (interestEarned / finalAmount) * 100 : 0;
    calcInterestShare.textContent = iShare.toFixed(2) + "% of final amount";

    calcRatioPrincipal.style.width = pShare.toFixed(2) + "%";
    calcRatioInterest.style.width = iShare.toFixed(2) + "%";
    calcPrincipalPct.textContent = pShare.toFixed(1) + "%";
    calcInterestPct.textContent = iShare.toFixed(1) + "%";

    // Populate all 5 schedule rows
    var simpleFinalRow = calcSimple(p, r, t);
    document.getElementById("row-simple-int").textContent = formatINR(simpleFinalRow - p);
    document.getElementById("row-simple-final").textContent = formatINR(simpleFinalRow);
    document.getElementById("row-simple-real").textContent = formatINR(
      calcReal(simpleFinalRow, inf, t)
    );

    var freqs = [1, 2, 4, 12];
    for (var f = 0; f < freqs.length; f += 1) {
      var freq = freqs[f];
      var fFinal = calcCompound(p, r, t, freq);
      document.getElementById("row-" + freq + "-int").textContent = formatINR(fFinal - p);
      document.getElementById("row-" + freq + "-final").textContent = formatINR(fFinal);
      document.getElementById("row-" + freq + "-real").textContent = formatINR(
        calcReal(fFinal, inf, t)
      );
    }
  }

  calcPrincipal.addEventListener("input", updateCalculator);
  calcRate.addEventListener("input", updateCalculator);
  calcYears.addEventListener("input", updateCalculator);
  calcFrequency.addEventListener("change", updateCalculator);
  calcInflation.addEventListener("input", updateCalculator);

  // ---------------------------------------------------------------------------
  // Tab 3: Goal Logic
  // ---------------------------------------------------------------------------
  function updateGoal() {
    var startRes = parseRequiredPositive(goalStart, "starting amount");
    var targetRes = parseRequiredPositive(goalTarget, "target amount");
    var rateRes = parseRequiredPositive(goalRate, "interest rate");
    var infRes = parseOptionalNonNegative(goalInflation, "inflation rate");

    if (startRes.valid && targetRes.valid && targetRes.value <= startRes.value) {
      targetRes = {
        valid: false,
        error: "Target amount must be greater than starting amount."
      };
    }

    setFieldError(goalStart, goalStartErr, startRes.error);
    setFieldError(goalTarget, goalTargetErr, targetRes.error);
    setFieldError(goalRate, goalRateErr, rateRes.error);
    setFieldError(goalInflation, goalInflationErr, infRes.error);

    var n = Number(goalFrequency.value) || 1;
    var freqNames = {
      1: "Yearly",
      2: "Half-yearly",
      4: "Quarterly",
      12: "Monthly"
    };

    var goalRows = goalComparisonBody.querySelectorAll("tr");
    for (var i = 0; i < goalRows.length; i += 1) {
      var methodAttr = goalRows[i].getAttribute("data-goal-method");
      goalRows[i].classList.toggle("is-selected", methodAttr === String(n));
    }

    if (!startRes.valid || !targetRes.valid || !rateRes.valid || !infRes.valid) {
      goalYears.textContent = "\u2014";
      goalMonths.textContent = "\u2014";
      goalFreqLabel.textContent = freqNames[n] || "Yearly";
      goalGain.textContent = "\u2014";
      goalMultiplier.textContent = "\u2014";
      goalRealTarget.textContent = "\u2014";
      goalSimpleYears.textContent = "\u2014";
      goalTimeSaved.textContent = "\u2014";

      var resetIds = ["1", "2", "4", "12", "simple"];
      for (var k = 0; k < resetIds.length; k += 1) {
        document.getElementById("goal-row-" + resetIds[k] + "-years").textContent = "\u2014";
        document.getElementById("goal-row-" + resetIds[k] + "-months").textContent = "\u2014";
        document.getElementById("goal-row-" + resetIds[k] + "-real").textContent = "\u2014";
      }
      return;
    }

    var start = startRes.value;
    var target = targetRes.value;
    var rate = rateRes.value;
    var inf = infRes.value;

    var yrsCompound = calcGoalYearsCompound(start, target, rate, n);
    var yrsSimple = calcGoalYearsSimple(start, target, rate);
    var saved = yrsSimple - yrsCompound;
    var gain = target - start;
    var mult = target / start;
    var realTarget = calcReal(target, inf, yrsCompound);

    goalYears.textContent = yrsCompound.toFixed(2) + " years";
    goalMonths.textContent = "Approx. " + (yrsCompound * 12).toFixed(1) + " months";
    goalFreqLabel.textContent = freqNames[n] || "Yearly";

    goalGain.textContent = formatINR(gain);
    goalMultiplier.textContent = mult.toFixed(2) + "\u00D7 starting amount";
    goalRealTarget.textContent = formatINR(realTarget);

    goalSimpleYears.textContent = yrsSimple.toFixed(2) + " years";
    goalTimeSaved.textContent = saved.toFixed(2) + " years";

    var freqs = [1, 2, 4, 12];
    for (var f = 0; f < freqs.length; f += 1) {
      var freq = freqs[f];
      var fYrs = calcGoalYearsCompound(start, target, rate, freq);
      document.getElementById("goal-row-" + freq + "-years").textContent =
        fYrs.toFixed(2) + " years";
      document.getElementById("goal-row-" + freq + "-months").textContent =
        (fYrs * 12).toFixed(1) + " mo";
      document.getElementById("goal-row-" + freq + "-real").textContent = formatINR(
        calcReal(target, inf, fYrs)
      );
    }

    document.getElementById("goal-row-simple-years").textContent =
      yrsSimple.toFixed(2) + " years";
    document.getElementById("goal-row-simple-months").textContent =
      (yrsSimple * 12).toFixed(1) + " mo";
    document.getElementById("goal-row-simple-real").textContent = formatINR(
      calcReal(target, inf, yrsSimple)
    );
  }

  goalStart.addEventListener("input", updateGoal);
  goalTarget.addEventListener("input", updateGoal);
  goalRate.addEventListener("input", updateGoal);
  goalFrequency.addEventListener("change", updateGoal);
  goalInflation.addEventListener("input", updateGoal);

  // ---------------------------------------------------------------------------
  // Reset Defaults
  // ---------------------------------------------------------------------------
  resetBtn.addEventListener("click", function () {
    if (activeTab === "compare") {
      cmpPrincipal.value = "10000";
      cmpRate.value = "10";
      cmpYears.value = "3";
      cmpYearsSlider.value = "3";
      cmpInflation.value = "";
      updateSliderVisual(3);
      updateCompare();
    } else if (activeTab === "calculator") {
      calcPrincipal.value = "10000";
      calcRate.value = "10";
      calcYears.value = "3";
      calcFrequency.value = "1";
      calcInflation.value = "";
      setCalcType("compound");
    } else {
      goalStart.value = "10000";
      goalTarget.value = "20000";
      goalRate.value = "10";
      goalFrequency.value = "1";
      goalInflation.value = "";
      updateGoal();
    }
  });

  // ---------------------------------------------------------------------------
  // Responsive Canvas Resize Handling
  // ---------------------------------------------------------------------------
  if (typeof ResizeObserver !== "undefined") {
    var ro = new ResizeObserver(function () {
      if (activeTab === "compare") {
        drawChart();
      }
    });
    ro.observe(chartWrap);
  }
  window.addEventListener("resize", function () {
    if (activeTab === "compare") {
      drawChart();
    }
  });

  // Initial render
  updateSliderVisual(cmpYearsSlider.value);
  updateCompare();
  setCalcType("compound");
  updateGoal();
})();
