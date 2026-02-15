"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores/appStore";

interface ContextDocGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContextDocGuideDialog({ open, onOpenChange }: ContextDocGuideDialogProps) {
  const { t } = useTranslation("courseOverview");
  const [dontShowAgain, setDontShowAgain] = useState(false);

  function handleClose() {
    if (dontShowAgain) {
      useAppStore.getState().setContextDocGuideDismissed(true);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("contextDocGuideTitle")}</DialogTitle>
          <DialogDescription>{t("contextDocGuideP1")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{t("contextDocGuideP2")}</p>
          <p>{t("contextDocGuideP3")}</p>
          <p className="font-medium text-foreground">{t("contextDocGuideCta")}</p>
        </div>
        <DialogFooter className="flex-col gap-4 sm:flex-col">
          <div className="flex items-center gap-2">
            <Checkbox
              id="context-doc-guide-dismiss"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label htmlFor="context-doc-guide-dismiss" className="text-sm font-normal cursor-pointer">
              {t("contextDocGuideDismiss")}
            </Label>
          </div>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            {t("contextDocGuideClose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
