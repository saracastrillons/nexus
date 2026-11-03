import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function WeatherForecastChart({ data, motion = true }) {
  const chartData = data.time.map((date, index) => ({
    date: date,
    max: data.temperature_2m_max[index],
    min: data.temperature_2m_min[index],
  }));

  return (
    <div className="rounded-xl border border-cyan-900/40 bg-[#101a2e] p-6">
      <h3 className="mb-6 text-xl font-semibold text-cyan-400">
        Daily Temperature Forecast
      </h3>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#243247" strokeDasharray="3 3" />

            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              tickFormatter={(date) => {
                const [year, month, day] = date.split("-");
                return `${day} ${new Date(year, month - 1, day).toLocaleString(
                  "en-US",
                  {
                    month: "short",
                  },
                )}`;
              }}
            />

            <YAxis stroke="#94a3b8" unit="°C" />

            <Tooltip
              contentStyle={{
                backgroundColor: "#0d1424",
                border: "1px solid #164e63",
                borderRadius: "10px",
              }}
            />

            <Legend />

            <Line
              isAnimationActive={motion}
              type="monotone"
              dataKey="max"
              name="Maximum Temperature"
              stroke="#f97316"
              strokeWidth={3}
            />

            <Line
              isAnimationActive={motion}
              type="monotone"
              dataKey="min"
              name="Minimum Temperature"
              stroke="#22d3ee"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default WeatherForecastChart;
