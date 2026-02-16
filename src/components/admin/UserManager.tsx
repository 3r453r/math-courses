"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  accessStatus: string;
  accessGrantedAt: string | null;
  accessSource: string | null;
  createdAt: string;
  _count: { courses: number };
}

export function UserManager() {
  const { t } = useTranslation(["admin"]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(userId: string, data: Record<string, string>) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, ...updated } : u))
        );
        toast.success(t("admin:users.updated"));
      }
    } catch (err) {
      console.error("Failed to update user:", err);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (users.length === 0) {
    return <p className="text-muted-foreground">{t("admin:users.noUsers")}</p>;
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-medium">{t("admin:users.name")}</th>
            <th className="text-left p-3 font-medium">{t("admin:users.email")}</th>
            <th className="text-left p-3 font-medium">{t("admin:users.role")}</th>
            <th className="text-left p-3 font-medium">{t("admin:users.accessStatus")}</th>
            <th className="text-left p-3 font-medium">{t("admin:users.source")}</th>
            <th className="text-left p-3 font-medium">{t("admin:users.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t">
              <td className="p-3">{user.name ?? "—"}</td>
              <td className="p-3 text-muted-foreground">{user.email ?? "—"}</td>
              <td className="p-3">
                <Badge variant={user.role === "admin" ? "default" : "outline"}>
                  {user.role}
                </Badge>
              </td>
              <td className="p-3">
                <Badge
                  variant={
                    user.accessStatus === "active"
                      ? "default"
                      : user.accessStatus === "suspended"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {user.accessStatus}
                </Badge>
              </td>
              <td className="p-3 text-muted-foreground">
                {user.accessSource ?? "—"}
              </td>
              <td className="p-3">
                {user.role === "owner" ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex gap-2">
                    {user.role !== "admin" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateUser(user.id, { role: "admin" })}
                      >
                        {t("admin:users.makeAdmin")}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateUser(user.id, { role: "user" })}
                      >
                        {t("admin:users.removeAdmin")}
                      </Button>
                    )}
                    {user.accessStatus !== "active" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateUser(user.id, { accessStatus: "active" })}
                      >
                        {t("admin:users.activate")}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateUser(user.id, { accessStatus: "suspended" })}
                      >
                        {t("admin:users.suspend")}
                      </Button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
