// components/ui/label.jsx
import React from 'react';

export const Label = React.forwardRef(({ className = "", children, ...props }, ref) => (
  <label
    ref={ref}
    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
    {...props}
  >
    {children}
  </label>
));
Label.displayName = "Label";