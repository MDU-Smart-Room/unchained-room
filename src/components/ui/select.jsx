// components/ui/select.jsx
import React from 'react';

export const Select = React.forwardRef(({ children, value, onValueChange, ...props }, ref) => (
  <select
    ref={ref}
    value={value}
    onChange={(e) => onValueChange(e.target.value)}
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export const SelectTrigger = React.forwardRef(({ children, className = "", ...props }, ref) => (
  <div className={`relative ${className}`} ref={ref} {...props}>
    {children}
  </div>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectValue = React.forwardRef(({ children, ...props }, ref) => (
  <span ref={ref} {...props}>{children}</span>
));
SelectValue.displayName = "SelectValue";

export const SelectContent = React.forwardRef(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>{children}</div>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = React.forwardRef(({ children, value, ...props }, ref) => (
  <option ref={ref} value={value} {...props}>
    {children}
  </option>
));
SelectItem.displayName = "SelectItem";