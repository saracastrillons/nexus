import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function PrecipitationChart({ data, motion = true }) {
  const chartData = data.time.map((date, index) => ({
    date: date,
    precipitation: data.precipitation_sum[index],
  }));

  return (
    <div className="rounded-xl border border-cyan-900/40 bg-[#101a2e] p-6">
      <h3 className="mb-6 text-xl font-semibold text-cyan-400">
        Daily Precipitation Forecast
      </h3>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
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

            <YAxis stroke="#94a3b8" unit=" mm" />

            <Tooltip
              cursor={{ fill: "#38bdf8", fillOpacity: 0.08 }}
              contentStyle={{
                backgroundColor: "#0d1424",
                border: "1px solid #164e63",
                borderRadius: "10px",
              }}
              formatter={(value) => [`${value} mm`, "Precipitation"]}
            />

            <Bar
              isAnimationActive={motion}
              dataKey="precipitation"
              fill="#38bdf8"
              radius={[6, 6, 0, 0]}
              name="Precipitation"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PrecipitationChart;
