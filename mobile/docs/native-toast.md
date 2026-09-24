# Native Toast Usage

Use `useNativeToast` from Vue components when a short native confirmation is useful.

```vue
<script setup lang="ts">
import { useNativeToast } from '@/app/composables/useNativeToast';

const { showToast } = useNativeToast();

async function saveChanges() {
  await showToast('Saved successfully');
}

async function showSaveError() {
  await showToast('Something went wrong', {
    duration: 'long',
    position: 'bottom',
  });
}
</script>
```
