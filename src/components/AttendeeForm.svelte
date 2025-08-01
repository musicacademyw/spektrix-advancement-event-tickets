<!-- Attendee Form Component - simplified styling focused on essentials -->
<script>
    import {Trash2, User, Utensils} from 'lucide-svelte';

    const {
        attendee = $bindable({
            firstName: '',
            lastName: '',
            mealChoice: '',
            dietaryRestrictions: ''
        }),
        eventName = '',
        ticketInfo = '',
        price = 0,
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

<div class="border border-surface-200 dark:border-surface-600 rounded p-3 bg-surface-25 dark:bg-surface-900 space-y-3">
    <!-- Attendee header with status -->
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Attendee #{index + 1}</span>
            {#if isComplete}
                <span class="badge preset-filled-success-500 text-xs">✓</span>
            {:else}
                <span class="badge preset-filled-warning-500 text-xs">Incomplete</span>
            {/if}
            <span class="text-sm text-surface-600 dark:text-surface-400">{ticketInfo} - ${price?.toFixed(0) || '0.00'}</span>
        </div>

        <div class="flex items-center gap-2">
            {#if Object.keys(groupedAttendees).length > 0}
                <select
                    class="select text-xs px-2 py-1 w-28"
                    onchange={(e) => {
                        const target = e.target;
                        if (target && 'value' in target) {
                            const selectedId = target.value;
                            if (selectedId) {
                                const sourceAttendee = availableAttendees.find(a => a.id === selectedId);
                                if (sourceAttendee) copyFromAttendee(sourceAttendee);
                                target.value = '';
                            }
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
                    <Trash2 size={12}/>
                </button>
            {/if}
        </div>
    </div>

    <!-- Form fields -->
    <div class="grid grid-cols-2 gap-2">
        <input
            class="input text-sm px-3 py-2"
            type="text"
            placeholder="First Name"
            bind:value={attendee.firstName}
            oninput={handleUpdate}
        />
        <input
            class="input text-sm px-3 py-2"
            type="text"
            placeholder="Last Name"
            bind:value={attendee.lastName}
            oninput={handleUpdate}
        />
    </div>

    <div class="grid grid-cols-2 gap-2">
        <select
            class="select text-sm px-3 py-2"
            bind:value={attendee.mealChoice}
            onchange={handleUpdate}
        >
            {#each mealOptions as option}
                <option value={option.value}>{option.label}</option>
            {/each}
        </select>

        <input
            class="input text-sm px-3 py-2"
            type="text"
            placeholder="Dietary restrictions (optional)"
            bind:value={attendee.dietaryRestrictions}
            oninput={handleUpdate}
        />
    </div>
</div>
