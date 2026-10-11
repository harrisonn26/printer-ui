<script lang="ts">
    import { confirmStore } from "../confirm.svelte";
    import Button from "./Button.svelte";

    let dialog: HTMLDialogElement | undefined = $state();
    let confirmButton: HTMLButtonElement | undefined = $state();

    const open = $derived(confirmStore.current != null);

    $effect(() => {
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            confirmButton?.focus();
        }
        if (!open && dialog.open) dialog.close();
    });

    const cancel = () => confirmStore.resolve(false);
</script>

<dialog
    bind:this={dialog}
    aria-labelledby="confirm-title"
    aria-describedby={confirmStore.current?.body ? "confirm-body" : undefined}
    onclose={cancel}
    oncancel={(event) => {
        // Let the dialog close normally; onclose resolves the promise.
        event.preventDefault();
        cancel();
    }}
>
    {#if confirmStore.current}
        <h2 id="confirm-title">{confirmStore.current.title}</h2>
        {#if confirmStore.current.body}
            <p id="confirm-body" class="muted">{confirmStore.current.body}</p>
        {/if}
        <div class="actions">
            <Button variant="ghost" onclick={cancel}>
                {confirmStore.current.cancelLabel ?? "Cancel"}
            </Button>
            <Button
                bind:element={confirmButton}
                variant={confirmStore.current.danger ? "danger" : "primary"}
                onclick={() => confirmStore.resolve(true)}
            >
                {confirmStore.current.confirmLabel ?? "Confirm"}
            </Button>
        </div>
    {/if}
</dialog>

<style>
    dialog {
        width: min(420px, calc(100vw - 2 * var(--space-4)));
        padding: var(--space-5) var(--space-6);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-lg);
        background: var(--surface);
        color: var(--text);
        box-shadow: 0 24px 64px rgb(0 0 0 / 0.45);
    }
    dialog::backdrop {
        background: rgb(0 0 0 / 0.55);
        backdrop-filter: blur(2px);
    }
    h2 {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: 700;
    }
    p {
        margin: var(--space-2) 0 0;
        font-size: var(--text-sm);
    }
    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        margin-top: var(--space-5);
    }
</style>
