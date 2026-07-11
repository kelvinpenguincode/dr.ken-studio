"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchOrdersSection() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter an order number or request ID to search");
      return;
    }
    setError("");
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSearch} className="space-y-3">
      <Input
        label="Order Number (any incoming tracking number is acceptable)"
        placeholder="Enter the order number to search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        error={error}
      />
      <Button type="submit" className="w-full sm:w-auto sm:min-w-32">
        Search
      </Button>
    </form>
  );
}
