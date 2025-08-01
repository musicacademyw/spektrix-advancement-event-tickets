<!-- Attendee Form Component - beautiful compact version with color coding -->
<script>
    import { Trash2, User, Utensils } from 'lucide-svelte';

    const {
        attendee = $bindable({
            firstName: '',
            lastName: '',
            mealChoice: '',
            dietaryRestrictions: ''
        }),
        eventName = '',
        ticketInfo = '',
        index = 0,
        canRemove = true,
        onupdate = () => {},
        onremove = () => {},
        availableAttendees = [],
        eventId = ''
    } = $props();

    const mealOptions = [
        { value: '', label: 'Select meal...' },
        { value: 'Meat', label: 'Meat' },
        { value: 'Fish', label: 'Fish' },
        { value: 'Vegetarian', label: 'Vegetarian' },
        { value: 'TBD', label: 'TBD' }
    ];

    // Improved color scheme for visual grouping by event
    const eventColors = [
        { border: 'border-l-red-400', bg: 'bg-red-50 dark:bg-red-950/10', accent: 'bg-red-100 dark:bg-red-900/20' },
        { border: 'border-l-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/10', accent: 'bg-blue-100 dark:bg-blue-900/20' },
        { border: 'border-l-green-400', bg: 'bg-green-50 dark:bg-green-950/10', accent: 'bg-green-100 dark:bg-green-900/20' },
        { border: 'border-l-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/10', accent: 'bg-purple-100 dark:bg-purple-900/20' },
        { border: 'border-l-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/10', accent: 'bg-orange-100 dark:bg-orange-900/20' }
    ];

    const colorIndex = eventId ? Math.abs(eventId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % eventColors.length : 0;
    const colors = eventColors[colorIndex];

    // Check if form is complete
    const isComplete = $derived(attendee.firstName && attendee.lastName && attendee.mealChoice);

    function handleRemove() {
        onremove(index);
    }

    function handleUpdate() {
        onupdate({ index, attendee });
    }

    function copyFromAttendee(sourceAttendee) {
        attendee.firstName = sourceAttendee.firstName;
        attendee.lastName = sourceAttendee.lastName;
        handleUpdate();
    }

    // Group available attendees by event
    const groupedAttendees = $derived(() => {
        const groups = {};
        availableAttendees.forEach(att => {
            if (att.firstName && att.lastName && att.id !== attendee.id) {
                if (!groups[att.eventName]) groups[att.eventName] = [];
                groups[att.eventName].push(att);
            }
        });
        return groups;
    });
</script>

<div class="card p-4 space-y-3 border-l-4 {colors.border} {colors.bg} shadow-sm hover:shadow-md transition-all duration-200">
    <!-- Header with attendee info and actions -->
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
                <span class="badge preset-tonal-primary text-xs font-medium">#{index + 1}</span>
                {#if isComplete}
                    <span class="badge preset-filled-success-500 text-xs">✓ Complete</span>
                {:else}
                    <span class="badge preset-tonal-warning text-xs">Incomplete</span>
                {/if}
            </div>

            <div class="text-xs text-surface-600 dark:text-surface-400">
                <div class="font-semibold text-surface-800 dark:text-surface-200 truncate max-w-32">{eventName}</div>
                <div class="truncate max-w-32">{ticketInfo}</div>
            </div>
        </div>

        <div class="flex items-center gap-2">
            {#if Object.keys(groupedAttendees).length > 0}
                <select
                    class="select select-sm text-xs w-32 {colors.accent}"
                    onchange={(e) => {
                        const selectedId = e.target.value;
                        if (selectedId) {
                            const sourceAttendee = availableAttendees.find(a => a.id === selectedId);
                            if (sourceAttendee) copyFromAttendee(sourceAttendee);
                            e.target.value = '';
                        }
                    }}
                >
                    <option value="">Copy from...</option>
                    {#each Object.entries(groupedAttendees) as [eventName, attendees]}
                        <optgroup label={eventName}>
                            {#each attendees as att}
                                <option value={att.id}>{att.firstName} {att.lastName}</option>
                            {/each}
                        </optgroup>
                    {/each}
                </select>
            {/if}

            {#if canRemove}
                <button
                    class="btn-icon btn-icon-sm variant-filled-error hover:scale-105 transition-transform"
                    onclick={handleRemove}
                    type="button"
                    title="Remove attendee"
                >
                    <Trash2 size={12} />
                </button>
            {/if}
        </div>
    </div>

    <!-- Name inputs with icons -->
    <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={14} class="text-surface-400" />
                </div>
                <input
                    class="input input-sm pl-9 {colors.accent} border-surface-200 dark:border-surface-600 focus:ring-primary-500 focus:border-primary-500"
                    type="text"
                    placeholder="First Name"
                    bind:value={attendee.firstName}
                    oninput={handleUpdate}
                />
            </div>
            <input
                class="input input-sm {colors.accent} border-surface-200 dark:border-surface-600 focus:ring-primary-500 focus:border-primary-500"
                type="text"
                placeholder="Last Name"
                bind:value={attendee.lastName}
                oninput={handleUpdate}
            />
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Utensils size={14} class="text-surface-400" />
                </div>
                <select
                    class="select select-sm pl-9 {colors.accent} border-surface-200 dark:border-surface-600 focus:ring-primary-500 focus:border-primary-500"
                    bind:value={attendee.mealChoice}
                    onchange={handleUpdate}
                >
                    {#each mealOptions as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </div>

            <input
                class="input input-sm {colors.accent} border-surface-200 dark:border-surface-600 focus:ring-primary-500 focus:border-primary-500"
                type="text"
                placeholder="Dietary restrictions"
                bind:value={attendee.dietaryRestrictions}
                oninput={handleUpdate}
            />
        </div>
    </div>
</div>
