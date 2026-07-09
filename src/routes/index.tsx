import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Overview" },
      {
        name: "description",
        content: "Monitor your key metrics, revenue, and activity at a glance.",
      },
      { property: "og:title", content: "Dashboard — Overview" },
      {
        property: "og:description",
        content: "Monitor your key metrics, revenue, and activity at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

const stats = [
  {
    label: "Total Revenue",
    value: "$48,290",
    change: "+12.5%",
    trend: "up" as const,
    icon: DollarSign,
  },
  {
    label: "Active Users",
    value: "2,318",
    change: "+8.2%",
    trend: "up" as const,
    icon: Users,
  },
  {
    label: "Conversion Rate",
    value: "3.42%",
    change: "-1.1%",
    trend: "down" as const,
    icon: TrendingUp,
  },
  {
    label: "Active Sessions",
    value: "1,024",
    change: "+4.6%",
    trend: "up" as const,
    icon: Activity,
  },
];

const activity = [
  { name: "Olivia Martin", action: "created a new project", time: "2m ago" },
  { name: "Jackson Lee", action: "upgraded to Pro plan", time: "1h ago" },
  { name: "Isabella Nguyen", action: "invited 3 team members", time: "3h ago" },
  { name: "William Kim", action: "closed a support ticket", time: "5h ago" },
  { name: "Sofia Davis", action: "published a report", time: "1d ago" },
];

function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar px-4 py-6 md:block">
          <div className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-sidebar-foreground">
              Acme Inc
            </span>
          </div>
          <nav className="space-y-1">
            {[
              { label: "Overview", icon: LayoutDashboard, active: true },
              { label: "Customers", icon: Users, active: false },
              { label: "Revenue", icon: DollarSign, active: false },
              { label: "Analytics", icon: Activity, active: false },
            ].map((item) => (
              <a
                key={item.label}
                href="#"
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 px-6 py-8">
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back, here's what's happening today.
            </p>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <p
                    className={`mt-1 flex items-center gap-1 text-xs ${
                      stat.trend === "up"
                        ? "text-emerald-600"
                        : "text-destructive"
                    }`}
                  >
                    {stat.trend === "up" ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {stat.change} from last month
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Revenue overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-56 items-end gap-2">
                  {[40, 65, 45, 80, 55, 90, 70, 100, 60, 85, 75, 95].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-primary/80 transition-colors hover:bg-primary"
                        style={{ height: `${h}%` }}
                      />
                    ),
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activity.map((item) => (
                  <div key={item.name} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {item.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{item.name}</span>{" "}
                        <span className="text-muted-foreground">
                          {item.action}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.time}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
