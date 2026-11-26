"use client";

import { useEffect, useState } from "react";
import { FolderTree, Plus, Pencil, Trash2, Loader2, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function PotentialCategoryDialog({
  open, onClose, categories = [], questions = [],
  onCreate, onUpdate, onDelete, saving = false
}) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setEditingId(null);
      setDeleteId(null);
      setError("");
    }
  }, [open]);

  const reset = () => {
    setName("");
    setEditingId(null);
    setError("");
  };
  const save = async event => {
    event.preventDefault();
    if (!name.trim()) return setError("Category name is required.");
    setError("");
    try {
      if (editingId) await onUpdate(editingId, { name: name.trim() });
      else await onCreate({ name: name.trim() });
      reset();
    } catch (error) {
      setError(error.message || "Unable to save category.");
    }
  };
  const remove = async id => {
    try {
      await onDelete(id);
      setDeleteId(null);
      if (editingId === id) reset();
    } catch (error) {
      setError(error.message || "Unable to delete category.");
    }
  };
  return (
    <Dialog open={open} onOpenChange={value => !value && !saving && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FolderTree className="h-5 w-5 text-primary" />Potential Question Categories</DialogTitle>
          <DialogDescription>Create and manage categories independently of Performance categories.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex gap-2">
          <Input value={name} disabled={saving} placeholder={editingId ? "Update category name" : "Enter new category name"} onChange={event => setName(event.target.value)} />
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
          {editingId && <Button type="button" variant="outline" disabled={saving} onClick={reset}><X className="h-4 w-4" /></Button>}
        </form>
        {error && <p className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {categories.map(category => {
            const count = category.question_count ?? questions.filter(question => Number(question.category?.id ?? question.category) === Number(category.id)).length;
            return (
              <div key={category.id} className="space-y-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{category.name}</p>
                    <Badge variant="secondary" className="mt-1">{count} questions</Badge>
                  </div>
                  <Button variant="ghost" size="icon" disabled={saving} onClick={() => {
                    setEditingId(category.id);
                    setName(category.name);
                    setDeleteId(null);
                    setError("");
                  }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" disabled={saving} onClick={() => setDeleteId(category.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {deleteId === category.id && (
                  <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-xs">Delete this category? Existing question associations may prevent deletion.</p>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => setDeleteId(null)}>Cancel</Button>
                      <Button size="sm" variant="destructive" disabled={saving} onClick={() => remove(category.id)}>Delete Category</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!categories.length && <p className="py-8 text-center text-sm text-muted-foreground">No Potential categories created yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}