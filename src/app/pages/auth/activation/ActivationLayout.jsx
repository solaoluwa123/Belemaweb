"use client";

import { Outlet } from "react-router";
import { ActivationProvider } from "../../../context/ActivationContext";

export default function ActivationLayout() {
  return (
    <ActivationProvider>
      <Outlet />
    </ActivationProvider>
  );
}
