function LoadSpin({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <div
      className={size === "sm" ? "load-spin is-sm" : "load-spin"}
      role="status"
      aria-label="Ladataan"
    />
  );
}

export default LoadSpin;
