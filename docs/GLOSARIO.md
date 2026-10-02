# Glosario SOED (vocabulario único)

Usar exactamente estos términos en código, base de datos, interfaz y commits. El código usa el término en español sin tildes (`coreografia`, `acreditacion`). La columna portugués es la propuesta de interfaz **a validar con el organizador** (pendiente P-07).

| Código | Español (UI) | Português (UI) | Definición |
| --- | --- | --- | --- |
| `organizacion` | Organización | Organização | El cliente dueño de la instancia. No es una tabla: es la instancia completa (ADR-0003). |
| `temporada` | Temporada | Temporada | Ciclo anual con selectivos y final. Tiene un reglamento por defecto. |
| `evento` | Evento | Evento | Selectivo, final o evento único. Unidad de aislamiento de datos y permisos. |
| `SELECTIVO` | Selectivo | Seletiva | Evento clasificatorio regional. |
| `FINAL` | Final | Final | Encuentro final de la temporada. |
| `sede` | Sede | Sede | Venue, ciudad, estado o provincia, país y zona horaria del evento. |
| `pista` | Pista | Palco | Escenario donde se presentan coreografías; puede haber varias en paralelo. |
| `bloque` | Bloque | Bloco | Tramo del cronograma de una pista con horario de inicio. |
| `reglamento` | Reglamento | Regulamento | Configuración de reglas (ADR-0006). |
| `categoria` | Categoría | Categoria | Rango de edad (por ejemplo, Infantil o Juvenil). |
| `genero` | Género | Gênero | Estilo de danza (Jazz, Ballet Clásico, Reggaeton…). |
| `formacion` | Formación | Formação | Cantidad de integrantes: `SOLO` (Solista/Solo), `DUO` (Dúo/Duo), `TRIO` (Trío/Trio), `GRUPO` (Grupo/Grupo) y otras configurables como `QUADRO`. |
| `tolerancia` | Tolerancia | Tolerância | Margen permitido: porcentaje de integrantes fuera de categoría en grupos o segundos sobre el tiempo máximo. |
| `academia` | Academia | Academia / Escola | Escuela o grupo que inscribe bailarines. Se comparte en toda la temporada. |
| `profesor` | Profesor / Dirigente | Professor / Diretor | Usuario que opera una academia. |
| `bailarin` | Bailarín / Bailarina | Bailarino / Bailarina | Persona que baila. Se carga una sola vez. |
| `coreografia` | Coreografía | Coreografia | Obra reutilizable: nombre, género, formación, elenco y música. |
| `elenco` | Elenco | Elenco | Bailarines de una coreografía o ficha. |
| `inscripcion` | Inscripción | Inscrição | Alta de una academia en un evento. |
| `ficha` | Ficha | Ficha de inscrição | Coreografía inscripta a un evento, con estado, validación y bloqueo. |
| `tarifario` | Tarifario | Tabela de preços | Reglas de precio del evento. |
| `liquidacion` | Liquidación | Demonstrativo de pagamento | Cálculo de lo que debe una academia. No es factura. Número `LIQ-<SLUG>-0001`. |
| `cobro` | Cobro | Recebimento | Registro manual de un pago recibido. Se anula, nunca se borra. |
| `medio` | Medio de cobro | Forma de pagamento | Efectivo, Mercado Pago, transferencia, PIX u otro. |
| `turno_caja` | Turno de caja | Turno de caixa | Período de cobros de una persona para el cierre de caja. |
| `orden_salida` | Orden de salida | Ordem de apresentação | Secuencia de presentaciones por pista y bloque. |
| `jurado` | Jurado | Jurado (Júri) | Persona que puntúa. |
| `director_tecnico` | Director técnico | Diretor técnico | Supervisa planillas y desvíos de los jurados. |
| `planilla` | Planilla | Planilha / Súmula | Puntajes y comentario de un jurado para una ficha. |
| `criterio` | Criterio | Critério | Aspecto puntuado (técnica, interpretación…), con peso. |
| `banda` | Clasificación | Classificação | Nivel según el puntaje final (umbrales 9,0 / 8,0 / 7,0). |
| `resultado` | Resultado | Resultado | Puntaje final, banda y puesto de una ficha. |
| `premio` | Premio | Prêmio | Premio principal o especial, global o del evento. |
| `pase` | Pase | Classificação para a final | Habilitación manual a la final con motivo y beneficio opcional. |
| `acreditacion` | Acreditación | Credenciamento | Registro de ingreso con credencial QR. |
| `credencial` | Credencial | Credencial | QR por persona y evento. |
| `coordinador` | Coordinador en vivo | Coordenador | Opera el orden de salida durante el evento. |
| `locutor` | Locutor | Locutor | Anuncia las coreografías. |
| `dj` | DJ / Sonido | DJ / Sonoplastia | Reproduce la música en orden. |
| `staff_acreditacion` | Staff de acreditación | Equipe de credenciamento | Opera la mesa de acreditación y cobros. |
| `comunicado` | Comunicado | Comunicado | Mensaje masivo por evento e idioma. |
| `solicitud_modificacion` | Solicitud de modificación | Solicitação de alteração | Pedido de cambio de una ficha después del cierre. |
| `super_admin` | Super Admin | Super Admin | Administrador de la instancia. |
| `organizador_evento` | Organizador del evento | Organizador do evento | Administra un evento asignado. |
