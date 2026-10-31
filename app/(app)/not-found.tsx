import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-3xl font-medium">Záznam tu není</h1>
      <p className="mt-3 text-sm text-muted-foreground">Odkaz vede na doklad nebo odběratele, který v evidenci není.</p>
      <Link href="/" className={`${buttonVariants()} mt-6`}>
        Zpět na přehled
      </Link>
    </div>
  );
}
