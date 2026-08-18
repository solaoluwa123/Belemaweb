"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../ui/utils";

/**
 * Consistent card shell for auth screens: icon area, title, description, and content.
 * Supports optional step indicator for multi-step flows.
 */
export function AuthCardLayout({
  icon: IconComponent,
  iconBgClassName = "bg-blue-600",
  iconClassName,
  title,
  description,
  step,
  stepLabel,
  children,
  className,
  cardClassName,
  ...props
}) {
  return (
    <Card
      className={cn(
        "w-full max-w-md shadow-xl border-slate-700/50",
        cardClassName
      )}
      aria-labelledby="auth-card-title"
      aria-describedby={description ? "auth-card-description" : undefined}
      {...props}
    >
      <CardHeader className="space-y-4 text-center">
        {(step !== undefined && stepLabel) && (
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider" aria-hidden="true">
            {stepLabel}
          </p>
        )}
        <div className="flex justify-center">
          <div
            className={cn(
              "w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center",
              iconBgClassName
            )}
          >
            {IconComponent && (
              <IconComponent className={cn("w-7 h-7 sm:w-8 sm:h-8 text-white", iconClassName)} aria-hidden="true" />
            )}
          </div>
        </div>
        <div>
          <CardTitle id="auth-card-title" className="text-xl sm:text-2xl">
            {title}
          </CardTitle>
          {description && (
            <CardDescription id="auth-card-description" className="mt-1.5 text-sm sm:text-base">
              {description}
            </CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-4", className)}>
        {children}
      </CardContent>
    </Card>
  );
}
