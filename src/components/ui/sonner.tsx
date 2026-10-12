import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group pointer-events-none [&_[data-sonner-toast]]:pointer-events-auto"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-[var(--denim-r)] group-[.toaster]:bg-paper group-[.toaster]:text-foreground group-[.toaster]:border-0 group-[.toaster]:border-l-4 group-[.toaster]:border-l-pri group-[.toaster]:shadow-[var(--denim-shadow)] group-[.toaster]:font-sans data-[type=success]:group-[.toaster]:border-l-acc data-[type=error]:group-[.toaster]:border-l-danger-600 data-[type=warning]:group-[.toaster]:border-l-warning-700",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:rounded-full group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:rounded-full group-[.toast]:bg-pt group-[.toast]:text-pri",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
