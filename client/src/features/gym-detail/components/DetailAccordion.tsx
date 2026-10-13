import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type DetailAccordionId =
  | "hours"
  | "memberships"
  | "services"
  | "chain"
  | "contacts";

export function DetailAccordion(props: {
  id: DetailAccordionId;
  openId: DetailAccordionId | null;
  onToggle: (id: DetailAccordionId) => void;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const open = props.openId === props.id;
  return (
    <div className={open ? "gym-detail-acc is-open" : "gym-detail-acc"}>
      <button
        type="button"
        className="gym-detail-acc-head"
        aria-expanded={open}
        onClick={() => props.onToggle(props.id)}
      >
        <span className="gym-detail-acc-icon" aria-hidden="true">
          {props.icon}
        </span>
        <span className="gym-detail-acc-title">{props.title}</span>
        <ChevronDown
          className="gym-detail-acc-chevron"
          size={18}
          strokeWidth={2.3}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="gym-detail-acc-body">{props.children}</div>
      ) : null}
    </div>
  );
}
