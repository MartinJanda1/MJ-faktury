import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function MissingRecord({ title, description, href, label }: { title: string; description: string; href: string; label: string }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-3xl font-medium">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      <Link href={href} className={`${buttonVariants()} mt-6`}>
        {label}
      </Link>
    </div>
  );
}
