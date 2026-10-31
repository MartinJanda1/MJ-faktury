"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConfirmDelete({
  action,
  id,
  title,
  description,
  label = "Smazat",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  title: string;
  description: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>{label}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Zpět</DialogClose>
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="destructive">
              Smazat
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
