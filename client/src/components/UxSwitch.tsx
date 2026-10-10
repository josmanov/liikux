import "./UxSwitch.css";

type Props = {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  size?: "md" | "sm";
  dim?: boolean;
};

function UxSwitch({
  checked,
  onChange,
  disabled = false,
  size = "md",
  dim = false,
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || !onChange}
      className={[
        "ux-switch",
        checked ? "is-on" : "",
        size === "sm" ? "is-sm" : "",
        dim ? "is-dim" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => {
        if (disabled || !onChange) return;
        onChange(!checked);
      }}
    >
      <span className="ux-slider" aria-hidden="true" />
    </button>
  );
}

export default UxSwitch;
