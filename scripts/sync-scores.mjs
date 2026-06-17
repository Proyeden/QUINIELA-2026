Dos problemas identificados:

1. **ESPN usa "Argelia"** (en español) en vez de "Algeria" → el script no encuentra el partido
2. **Noruega sigue en vivo** → el status de ESPN sigue siendo `STATUS_IN_PROGRESS` aunque ya terminó

Ambos se resuelven en el script:Sube este `sync-scores.mjs` a GitHub. En el próximo run deberías ver en el log:

```
[STATUS_IN_PROGRESS] Argentina vs Argelia 1-0
  Partido 19: 1-0 final:false
Firebase actualizado (1 cambio(s))
```

Y en la app aparecerá el marcador **🔴 EN VIVO** automáticamente.

Para Noruega — si ESPN aún lo tiene como `STATUS_IN_PROGRESS` pero ya terminó, el admin puede entrar el resultado manualmente desde el panel (que tiene prioridad sobre la API y no se sobrescribe).
