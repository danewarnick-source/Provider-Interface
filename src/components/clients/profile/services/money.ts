// Dollar formatting for Services & billing.
export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
