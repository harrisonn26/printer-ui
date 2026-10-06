<script lang="ts">
  import { confirmAction } from '../confirm.svelte'
  import Button from './Button.svelte'

  interface Props {
    label: string
    /** Heading and confirm-button text of the modal. */
    confirmLabel: string
    /** Optional explanation shown in the modal body. */
    message?: string
    onconfirm: () => Promise<unknown> | unknown
    variant?: 'secondary' | 'ghost' | 'outline' | 'danger'
    confirmVariant?: 'primary' | 'danger'
    size?: 'sm' | 'md'
    icon?: string
    disabled?: boolean
    title?: string
  }

  let {
    label,
    confirmLabel,
    message,
    onconfirm,
    variant = 'secondary',
    confirmVariant = 'primary',
    size = 'sm',
    icon,
    disabled = false,
    title
  }: Props = $props()

  let loading = $state(false)

  const click = async () => {
    if (disabled || loading) return
    const confirmed = await confirmAction({
      title: confirmLabel,
      body: message,
      confirmLabel,
      danger: confirmVariant === 'danger'
    })
    if (!confirmed) return
    loading = true
    try {
      await onconfirm()
    } finally {
      loading = false
    }
  }
</script>

<Button
  {variant}
  {size}
  {icon}
  {loading}
  {disabled}
  {title}
  onclick={click}
>{label}</Button>
