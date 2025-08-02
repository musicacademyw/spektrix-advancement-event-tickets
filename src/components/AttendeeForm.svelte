<!-- Attendee Form Component - simplified styling focused on essentials -->
<script>
    import {ClipboardCheck, ClipboardX, FishOff, Trash2, User, Utensils} from 'lucide-svelte';

    const {
        attendee = {
            firstName: '',
            lastName: '',
            mealChoice: '',
            dietaryRestrictions: ''
        },
        eventName = '',
        ticketInfo = '',
        price = 0,
        index = 0,
        canRemove = true,
        onupdate = () => {
        },
        onremove = () => {
        },
        availableAttendees = [],
        eventId = ''
    } = $props();

    // Create local state variables for form inputs
    let firstName = $state(attendee.firstName);
    let lastName = $state(attendee.lastName);
    let mealChoice = $state(attendee.mealChoice);
    let dietaryRestrictions = $state(attendee.dietaryRestrictions);

    // Sync local state with prop changes
    $effect(() => {
        firstName = attendee.firstName;
        lastName = attendee.lastName;
        mealChoice = attendee.mealChoice;
        dietaryRestrictions = attendee.dietaryRestrictions;
    });

    const mealOptions = [
        {
            value: '',
            label: 'Select meal...'
        },
        {
            value: 'Meat',
            label: 'Meat'
        },
        {
            value: 'Fish',
            label: 'Fish'
        },
        {
            value: 'Vegetarian',
            label: 'Vegetarian'
        },
        {
            value: 'TBD',
            label: 'TBD'
        }
    ];

    // Check if form is complete using local state
    const isComplete = $derived(firstName && lastName && mealChoice);

    function handleRemove() {
        onremove(index);
    }

    function handleUpdate() {
        onupdate({
            index,
            attendee: {
                ...attendee,
                firstName,
                lastName,
                mealChoice,
                dietaryRestrictions
            }
        });
    }
</script>

<div class="card px-4 py-3 border border-dashed border-surface-200 dark:border-surface-700 space-y-3">
    <!-- Attendee header with status -->
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
            <span class="text-base font-semibold">Attendee #{index + 1}</span>
            <span class="badge preset-tonal-surface italic">{ticketInfo}
                - ${price?.toFixed(0) || '0'}</span>
        </div>

        <div class="flex items-center gap-2">
            {#if isComplete}
                <span class="badge preset-filled-success-500">
                    <ClipboardCheck class="w-4 h-4"/>
                    Complete
                </span>
            {:else}
                <span class="badge preset-filled-warning-500">
                    <ClipboardX class="w-4 h-4"/>
                    Incomplete
                </span>
            {/if}
            {#if canRemove}
                <button
                        class="btn-icon preset-outlined-error-200-800 p-1"
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
    <div class="grid grid-cols-1 gap-2">
        <div class="input-group grid-cols-[auto_1fr_1fr]">
            <div class="ig-cell preset-tonal">
                <User class="w-4 h-4"/>
            </div>
            <input
                    class="ig-input text-xs px-3 py-1"
                    type="text"
                    autocomplete="given-name"
                    placeholder="First Name"
                    bind:value={firstName}
                    oninput={handleUpdate}
            />
            <input
                    class="ig-input text-xs px-3 py-2"
                    type="text"
                    autocomplete="family-name"
                    placeholder="Last Name"
                    bind:value={lastName}
                    oninput={handleUpdate}
            />
        </div>
    </div>

    <div class="grid grid-cols-3 gap-2">
        <div class="input-group grid-cols-[auto_1fr]">
            <div class="ig-cell preset-tonal">
                <Utensils class="w-4 h-4"/>
            </div>
            <select
                    class="ig-select text-xs px-3 py-2"
                    bind:value={mealChoice}
                    onchange={handleUpdate}
            >
                {#each mealOptions as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </div>

        <div class="input-group grid-cols-[auto_1fr] col-span-2">
            <div class="ig-cell preset-tonal">
                <FishOff class="w-4 h-4"/>
            </div>
            <input
                    class="ig-input text-xs px-3 py-2"
                    type="text"
                    placeholder="Dietary restrictions (optional)"
                    bind:value={dietaryRestrictions}
                    oninput={handleUpdate}
            />
        </div>
    </div>
</div>
