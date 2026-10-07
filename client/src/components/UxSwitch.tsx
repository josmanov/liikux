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
    <span
      className={[
        "ux-switch",
        size === "sm" ? "is-sm" : "",
        dim ? "is-dim" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        readOnly={disabled || !onChange}
        onChange={
          onChange ? (e) => onChange(e.target.checked) : undefined
        }
      />
      <span className="ux-slider"></span>
    </span>
  );
}

export default UxSwitch;
