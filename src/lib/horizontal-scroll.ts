import type { WheelEvent } from "react";
export function handleHorizontalWheel(event: WheelEvent<HTMLElement>) {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth)
        return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX))
        return;
    event.preventDefault();
    element.scrollLeft += event.deltaY;
}
