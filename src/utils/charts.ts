type SeriesPoint = {
  label: string;
  value: number;
};

type BarPoint = {
  label: string;
  value: number;
};

type PiePoint = {
  label: string;
  value: number;
};

function toQuickChartUrl(config: Record<string, unknown>): string {
  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?width=900&height=360&devicePixelRatio=2&backgroundColor=white&c=${encoded}`;
}

function colorWithAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

export function followerGrowthChart(points: SeriesPoint[], brandColor: string): string {
  const labels = points.map((p) => p.label);
  const values = points.map((p) => Number(p.value.toFixed(2)));
  return toQuickChartUrl({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Followers",
          data: values,
          borderColor: brandColor,
          backgroundColor: colorWithAlpha(brandColor, "22"),
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#475569", font: { size: 10 } } },
        y: { grid: { color: "#e2e8f0" }, ticks: { color: "#475569", font: { size: 10 } } }
      }
    }
  });
}

export function engagementTrendChart(points: SeriesPoint[], brandColor: string): string {
  const labels = points.map((p) => p.label);
  const values = points.map((p) => Number(p.value.toFixed(2)));
  return toQuickChartUrl({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Engagement %",
          data: values,
          borderColor: brandColor,
          backgroundColor: colorWithAlpha(brandColor, "1A"),
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#475569", font: { size: 10 } } },
        y: { grid: { color: "#e2e8f0" }, ticks: { color: "#475569", font: { size: 10 } } }
      }
    }
  });
}

export function postPerformanceChart(points: BarPoint[], brandColor: string): string {
  const labels = points.map((p) => p.label);
  const values = points.map((p) => Number(p.value.toFixed(2)));
  return toQuickChartUrl({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Reach",
          data: values,
          backgroundColor: colorWithAlpha(brandColor, "CC"),
          borderRadius: 6
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#475569", font: { size: 10 } } },
        y: { grid: { color: "#e2e8f0" }, ticks: { color: "#475569", font: { size: 10 } } }
      }
    }
  });
}

export function contentTypeBreakdownChart(points: PiePoint[]): string {
  const labels = points.map((p) => p.label);
  const values = points.map((p) => Number(p.value.toFixed(2)));
  return toQuickChartUrl({
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ["#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#3b82f6"]
        }
      ]
    },
    options: {
      plugins: {
        legend: { position: "right", labels: { color: "#334155", boxWidth: 10, font: { size: 10 } } }
      }
    }
  });
}

