import { useEffect, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import "./AreaSelect.css";

const areas = ["Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu"];

type Props = {
  value?: string;
  onChange?: (area: string) => void;
};

function AreaSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [internalArea, setInternalArea] = useState("Helsinki");
  const area = value ?? internalArea;

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  function pick(name: string) {
    if (onChange) onChange(name);
    else setInternalArea(name);
    setOpen(false);
  }

  return (
    <div className="area-select" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="area-select-btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <MapPin className="area-select-pin" size={16} strokeWidth={2.2} />
        <span className="area-select-label">{area}</span>
        <ChevronDown className="area-select-chevron" size={16} strokeWidth={2.2} />
      </button>
      {open ? (
        <ul className="area-select-menu" role="listbox">
          {areas.map((name) => (
            <li key={name}>
              <button
                type="button"
                className={name === area ? "is-on" : ""}
                role="option"
                aria-selected={name === area}
                onClick={() => pick(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default AreaSelect;
