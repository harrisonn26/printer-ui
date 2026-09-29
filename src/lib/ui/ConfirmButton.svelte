<script lang="ts">
  import Button from './Button.svelte'

  interface Props {
    label: string
    /** Shown after the first click; a second click within the window runs it. */
    confirmLabel: string
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
    onconfirm,
    variant = 'secondary',
    confirmVariant = 'primary',
    size = 'sm',
    icon,
    disabled = false,
    title
  }: Props = $props()

  const CONFIRM_MS = 4000

  let confirming = $state(false)
  let loading = $state(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  $effect(() => () => clearTimeout(timer))

  const click = async () => {
    if (!confirming) {
      confirming = true
      timer = setTimeout(() => { confirming = false }, CONFIRM_MS)
      return
    }
    clearTimeout(timer)
    confirming = false
    loading = true
    try {
      await onconfirm()
    } finally {
      loading = false
    }
  }
</script>

<Button
  variant={confirming ? confirmVariant : variant}
  {size}
  icon={confirming ? undefined : icon}
  {loading}
  {disabled}
  {title}
  onclick={click}
>{confirming ? confirmLabel : label}</Button>
