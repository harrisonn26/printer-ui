<script lang="ts">
    import { confirmAction } from "../confirm.svelte";
    import Button from "./Button.svelte";

    interface Props {
        label: string;
        /** Text on the modal's confirm button; short and verb-first. */
        confirmLabel: string;
        /**
         * Heading of the modal. Defaults to `confirmLabel`, which is fine when the
         * question needs no detail; pass a real question when the body explains it.
         */
        confirmTitle?: string;
        /** Optional explanation shown in the modal body. */
        message?: string;
        onconfirm: () => Promise<unknown> | unknown;
        variant?: "secondary" | "ghost" | "outline" | "danger";
        confirmVariant?: "primary" | "danger";
        size?: "sm" | "md";
        icon?: string;
        disabled?: boolean;
        /** External progress (e.g. a calibration Klipper is still running). */
        loading?: boolean;
        title?: string;
    }

    let {
        label,
        confirmLabel,
        confirmTitle,
        message,
        onconfirm,
        variant = "secondary",
        confirmVariant = "primary",
        size = "sm",
        icon,
        disabled = false,
        loading = false,
        title,
    }: Props = $props();

    let busy = $state(false);

    const click = async () => {
        if (disabled || loading || busy) return;
        const confirmed = await confirmAction({
            title: confirmTitle ?? confirmLabel,
            body: message,
            confirmLabel,
            danger: confirmVariant === "danger",
        });
        if (!confirmed) return;
        busy = true;
        try {
            await onconfirm();
        } finally {
            busy = false;
        }
    };
</script>

<Button
    {variant}
    {size}
    {icon}
    loading={loading || busy}
    {disabled}
    {title}
    onclick={click}>{label}</Button
>
