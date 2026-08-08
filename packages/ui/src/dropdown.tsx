import * as React from "react";
import { cn } from "./utils";

export interface DropdownProps {
  children: React.ReactNode;
  trigger: React.ReactNode;
  align?: "left" | "right";
}

export const Dropdown: React.FC<DropdownProps> = ({
  children,
  trigger,
  align = "left",
}) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {React.Children.map(children, (child) =>
            React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement<{ onClick?: () => void }>, {
                  onClick: () => {
                    setOpen(false);
                    if (
                      React.isValidElement(child) &&
                      typeof child.props === "object" &&
                      child.props !== null &&
                      "onClick" in child.props
                    ) {
                      (child.props as { onClick?: () => void }).onClick?.();
                    }
                  },
                })
              : child
          )}
        </div>
      )}
    </div>
  );
};

export interface DropdownItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
}

export const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  ({ className, children, destructive, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
DropdownItem.displayName = "DropdownItem";
