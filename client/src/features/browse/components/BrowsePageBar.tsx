import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageNums } from "../utils/pageNums";

type BrowsePageBarProps = {
  safePage: number;
  pageCount: number;
  previousLabel: string;
  nextLabel: string;
  onPage: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function BrowsePageBar(props: BrowsePageBarProps) {
  return (
    <div className="browse-pagebar">
      <button
        type="button"
        className="browse-pager-btn"
        aria-label={props.previousLabel}
        disabled={props.safePage <= 1}
        onClick={props.onPrev}
      >
        <ChevronLeft size={16} strokeWidth={2.2} />
      </button>
      <div className="browse-pages">
        {pageNums(props.safePage, props.pageCount).map((item, i) =>
          item === "gap" ? (
            <span className="browse-page-gap" key={`gap-${i}`}>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={
                item === props.safePage
                  ? "browse-page-num is-on"
                  : "browse-page-num"
              }
              onClick={() => props.onPage(item)}
            >
              {item}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        className="browse-pager-btn"
        aria-label={props.nextLabel}
        disabled={props.safePage >= props.pageCount}
        onClick={props.onNext}
      >
        <ChevronRight size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}
