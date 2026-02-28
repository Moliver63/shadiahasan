export default function StatsSection() {
  const stats = [
    {
      value: "500+",
      label: "Vidas Transformadas",
      gradient: "from-purple-600 to-blue-600",
    },
    {
      value: "50+",
      label: "Horas de Conteudo",
      gradient: "from-blue-600 to-cyan-600",
    },
    {
      value: "98%",
      label: "Satisfacao",
      gradient: "from-cyan-600 to-teal-600",
    },
    {
      value: "5+",
      label: "Anos de Experiencia",
      gradient: "from-teal-600 to-green-600",
    },
  ];

  return (
    <section className="py-16 bg-card border-y">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-2`}>
                {stat.value}
              </div>
              <div className="text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
