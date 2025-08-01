<script>
    import {onMount} from 'svelte';
    import {spektrixService} from './services/spektrix.js';
    import EventCard from './components/EventCard.svelte';
    import AttendeeForm from './components/AttendeeForm.svelte';
    import BasketSummary from './components/BasketSummary.svelte';
    import {RefreshCw, ShoppingCart} from 'lucide-svelte';

    const SPEKTRIX_EVENT_IDS = [
        '101001ASRCJQGCSBLJCPNPQQRRGSLJCLH',
        '101201AKQDJBPLLQCKLJCTLCMQDHDTGBQ'
    ];

    let events = $state([]);
    let availability = $state({});
    let selectedTickets = $state([]);
    let attendees = $state([]);
    let basketItems = $state({
        tickets: [],
        total: 0
    });
    let basketLoading = $state(true); // Add separate loading state for basket
    let loading = $state(true);
    let error = $state(null);
    let showAttendeeSection = $state(false);
    let isTabVisible = $state(true);

    // Auto-refresh availability every 30 seconds
    let availabilityInterval;

    onMount(() => {
        loadInitialData();

        // Set up tab visibility detection
        const handleVisibilityChange = () => {
            isTabVisible = !document.hidden;

            if (isTabVisible) {
                // Tab became visible - refresh data and restart interval
                refreshAvailability();
                startAvailabilityInterval();
            } else {
                // Tab became hidden - stop interval
                stopAvailabilityInterval();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Start periodic availability refresh only if tab is visible
        if (isTabVisible) {
            startAvailabilityInterval();
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            stopAvailabilityInterval();
        };
    });

    function startAvailabilityInterval() {
        // Clear any existing interval first
        stopAvailabilityInterval();

        // Only start if tab is visible
        if (isTabVisible) {
            availabilityInterval = setInterval(() => {
                if (isTabVisible) {
                    refreshAvailability();
                }
            }, 30000);
        }
    }

    function stopAvailabilityInterval() {
        if (availabilityInterval) {
            clearInterval(availabilityInterval);
            availabilityInterval = null;
        }
    }

    async function loadInitialData() {
        loading = true;
        error = null;

        try {
            // Load event details and availability (no client init needed)
            await Promise.all([
                loadEvents(),
                loadAvailability(),
                loadBasket()
            ]);
        } catch (err) {
            error = err.message;
            console.error('Error loading initial data:', err);
        } finally {
            loading = false;
        }
    }

    async function loadEvents() {
        const eventPromises = SPEKTRIX_EVENT_IDS.map(id =>
            spektrixService.getEventDetails(id)
        );
        events = await Promise.all(eventPromises);
    }

    async function loadAvailability() {
        const availabilityData = {};

        for (const eventId of SPEKTRIX_EVENT_IDS) {
            try {
                // Get instances for this event (no date filtering since each event has a single instance)
                const instances = await spektrixService.getEventInstances(eventId);

                if (instances.length > 0) {
                    // Get status, price list, and plan for the first instance
                    const instance = instances[0];
                    const [status, priceList, plan] = await Promise.all([
                        spektrixService.getInstanceStatus(instance.id),
                        spektrixService.getInstancePriceList(instance.id),
                        spektrixService.getInstancePlan(instance.id)
                    ]);

                    availabilityData[eventId] = {
                        instance,
                        status,
                        priceList,
                        plan
                    };
                }
            } catch (err) {
                console.error(`Error loading data for event ${eventId}:`, err);
            }
        }

        availability = availabilityData;
    }

    async function refreshAvailability() {
        try {
            await Promise.all([
                loadAvailability(),
                loadBasket()
            ]);
        } catch (err) {
            console.error('Error refreshing availability and basket:', err);
        }
    }

    async function loadBasket() {
        try {
            basketItems = await spektrixService.getBasketContents();
        } catch (err) {
            console.error('Error loading basket:', err);
            basketItems = {
                tickets: [],
                total: 0
            };
        } finally {
            basketLoading = false;
        }
    }

    function handleTicketSelection(selection) {
        // Remove existing selection for this event/ticket type/area combination
        selectedTickets = selectedTickets.filter(t =>
            !(t.eventId === selection.eventId &&
                t.ticketTypeId === selection.ticketTypeId &&
                t.areaId === selection.areaId)
        );

        // Add new selection if quantity > 0
        if (selection.quantity > 0) {
            selectedTickets = [
                ...selectedTickets,
                selection];
        }

        updateShowAttendeeSection();
    }

    function updateShowAttendeeSection() {
        const totalTickets = selectedTickets.reduce((sum, t) => sum + t.quantity, 0);
        showAttendeeSection = totalTickets > 0;

        // Update attendees list based on selected tickets
        updateAttendeesList();
    }

    function updateAttendeesList() {
        const newAttendees = [];

        selectedTickets.forEach(ticket => {
            for (let i = 0; i < ticket.quantity; i++) {
                // Try to find existing attendee data
                const existing = attendees.find(a =>
                    a.eventId === ticket.eventId &&
                    a.ticketTypeId === ticket.ticketTypeId &&
                    a.areaId === ticket.areaId &&
                    a.ticketIndex === i
                );

                newAttendees.push({
                    id: `${ticket.eventId}-${ticket.ticketTypeId}-${ticket.areaId}-${i}`,
                    eventId: ticket.eventId,
                    eventName: ticket.eventName,
                    ticketTypeId: ticket.ticketTypeId,
                    areaId: ticket.areaId,
                    ticketIndex: i,
                    ticketInfo: `${ticket.priceBandName} - ${ticket.areaName}`,
                    firstName: existing?.firstName || '',
                    lastName: existing?.lastName || '',
                    mealChoice: existing?.mealChoice || '',
                    dietaryRestrictions: existing?.dietaryRestrictions || ''
                });
            }
        });

        attendees = newAttendees;
    }

    function handleAttendeeUpdate(updateData) {
        const {
            index,
            attendee: updatedAttendee
        } = updateData;

        if (attendees[index]) {
            attendees[index] = {...attendees[index], ...updatedAttendee};
            attendees = [...attendees]; // Trigger reactivity
        }
    }

    function handleAttendeeRemove(index) {
        if (attendees[index]) {
            const attendee = attendees[index];

            // Remove this attendee and reduce the ticket quantity
            const ticketSelection = selectedTickets.find(t =>
                t.eventId === attendee.eventId &&
                t.ticketTypeId === attendee.ticketTypeId &&
                t.areaId === attendee.areaId
            );

            if (ticketSelection && ticketSelection.quantity > 1) {
                ticketSelection.quantity--;
                selectedTickets = [...selectedTickets];
            } else {
                // Remove the entire ticket selection
                selectedTickets = selectedTickets.filter(t =>
                    !(t.eventId === attendee.eventId &&
                        t.ticketTypeId === attendee.ticketTypeId &&
                        t.areaId === attendee.areaId)
                );
            }

            updateAttendeesList();
            updateShowAttendeeSection();
        }
    }

    async function addTicketsToBasket() {
        if (!validateAllAttendees()) {
            alert('Please fill in all required attendee information (name and meal choice) before adding to basket.');
            return;
        }

        loading = true;
        error = null;

        try {
            // Get current basket contents to identify existing ticket IDs
            const currentBasket = await spektrixService.getBasketContents();
            const existingTicketIds = new Set(currentBasket.tickets?.map(t => t.id) || []);

            // Build tickets array in the format Spektrix expects
            const ticketsToAdd = [];

            selectedTickets.forEach(ticket => {
                for (let i = 0; i < ticket.quantity; i++) {
                    ticketsToAdd.push({
                        instanceId: ticket.instanceId,
                        ticketTypeId: ticket.ticketTypeId,
                        planId: ticket.planId || ticket.areaId
                    });
                }
            });

            // Add all tickets to basket in one call
            const basketResponse = await spektrixService.addTicketsToBasket(ticketsToAdd);

            // Update ticket attributes for each ticket BEFORE reloading the basket
            if (Array.isArray(basketResponse) && basketResponse.length > 0) {

                // Filter to get only the newly added tickets (those not in existingTicketIds)
                const newlyAddedTickets = basketResponse.filter(ticket => !existingTicketIds.has(ticket.id));

                // Now map the newly added tickets to attendees in order
                for (let i = 0; i < newlyAddedTickets.length && i < attendees.length; i++) {
                    const ticket = newlyAddedTickets[i];
                    const attendee = attendees[i];

                    if (ticket && attendee) {
                        const attributes = {
                            'attribute_Registrant Name': `${attendee.firstName} ${attendee.lastName}`,
                            'attribute_Registrant Meal Choice': attendee.mealChoice,
                            ...(attendee.dietaryRestrictions && {'attribute_Registrant Dietary Restrictions': attendee.dietaryRestrictions})
                        };

                        try {
                            await spektrixService.updateTicketAttributes(ticket.id, attributes);
                        } catch (updateError) {
                            console.error(`[App] Failed to update ticket ${ticket.id}:`, updateError);
                        }
                    } else {
                        console.warn(`[App] Missing ticket or attendee data at index ${i}:`, {
                            ticket: !!ticket,
                            attendee: !!attendee
                        });
                    }
                }
            } else {
                console.warn('No tickets in basket response:', basketResponse);
            }

            // Clear selections and reload basket AFTER attributes are updated
            selectedTickets = [];
            attendees = [];
            showAttendeeSection = false;
            await loadBasket();

        } catch (err) {
            error = err.message;
            console.error('Error adding tickets to basket:', err);
        } finally {
            loading = false;
        }
    }

    function validateAllAttendees() {
        return attendees.every(attendee =>
            attendee.firstName.trim() &&
            attendee.lastName.trim() &&
            attendee.mealChoice
        );
    }

    async function handleBasketUpdated() {
        await loadBasket();
        // Refresh availability after basket changes to ensure current data
        await refreshAvailability();
    }

    function handleProceedToCheckout() {
        // In a real implementation, this would redirect to Spektrix checkout
        alert('This would redirect to the Spektrix checkout process. Implementation depends on your specific Spektrix setup.');
    }

    function copyAttendeeName(fromIndex, toIndex) {
        if (attendees[fromIndex] && attendees[toIndex]) {
            attendees[toIndex].firstName = attendees[fromIndex].firstName;
            attendees[toIndex].lastName = attendees[fromIndex].lastName;
            attendees = [...attendees]; // Trigger reactivity
        }
    }
</script>

<div class="container mx-auto p-4 space-y-6 max-w-7xl">

    {#if loading && events.length === 0}
        <!-- Large centered loading spinner -->
        <div class="flex items-center justify-center py-24">
            <div class="text-center space-y-4">
                <div class="animate-spin rounded-full h-16 w-16 border-4 border-primary-500 border-t-transparent mx-auto"></div>
                <p class="text-surface-600 dark:text-surface-400 text-lg">Loading events...</p>
            </div>
        </div>
    {:else if error}
        <div class="alert variant-filled-error">
            <span>Error: {error}</span>
            <button class="btn preset-filled-secondary-500" onclick={loadInitialData}>
                <RefreshCw size={16}/>
                <span>Retry</span>
            </button>
        </div>
    {:else}
        <div class="grid gap-6 lg:grid-cols-3">
            <!-- Left Column: Events (2/3 width) -->
            <div class="lg:col-span-2 gap-6">
                <div class="flex items-center justify-between">
                    <!-- Quick summary of selections -->
                    {#if selectedTickets.length > 0}
                        <span class="badge preset-filled-secondary-500">
                            {selectedTickets.reduce((sum, t) => sum + t.quantity, 0)} tickets selected
                        </span>
                    {/if}
                </div>

                <!-- Event cards with visual separation -->
                <div class="space-y-6">
                    {#each events as event, eventIndex}
                        <EventCard
                                {event}
                                availability={availability[event.id]}
                                {selectedTickets}
                                onticketselection={handleTicketSelection}
                        />
                    {/each}
                </div>
            </div>

            <!-- Right Column: Attendees & Basket (1/3 width) -->
            <div class="space-y-4">
                <!-- Attendee Information Section -->
                {#if showAttendeeSection}
                    <div class="space-y-3 animate-in slide-in-from-right-2 duration-300">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-semibold">Attendee Info</h3>
                            <button
                                    class="btn preset-filled-primary-500"
                                    onclick={addTicketsToBasket}
                                    disabled={!validateAllAttendees() || loading}
                            >
                                {#if loading}
                                    <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    <span>Adding...</span>
                                {:else}
                                    <ShoppingCart size={16}/>
                                    <span>Add to Basket</span>
                                {/if}
                            </button>
                        </div>

                        <!-- Group attendees by event -->
                        {#each events as event}
                            {@const eventAttendees = attendees.filter(a => a.eventId === event.id)}
                            {#if eventAttendees.length > 0}
                                <div class="space-y-2">
                                    <div class="flex items-center gap-2">
                                        <span class="badge preset-tonal-primary text-xs">{event.name}</span>
                                        <span class="text-xs text-surface-500">{eventAttendees.length}
                                            attendee{eventAttendees.length !== 1 ? 's' : ''}</span>
                                    </div>

                                    <div class="space-y-2">
                                        {#each eventAttendees as attendee, index}
                                            <div class="animate-in slide-in-from-right-2 duration-300"
                                                 style="animation-delay: {index * 50}ms">
                                                <AttendeeForm
                                                        {attendee}
                                                        eventName={attendee.eventName}
                                                        ticketInfo={attendee.ticketInfo}
                                                        index={attendees.indexOf(attendee)}
                                                        canRemove={attendees.length > 1}
                                                        onupdate={handleAttendeeUpdate}
                                                        onremove={handleAttendeeRemove}
                                                        availableAttendees={attendees}
                                                        eventId={event.id}
                                                />
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        {/each}

                        {#if !validateAllAttendees()}
                            <div class="alert variant-filled-warning text-sm">
                                <span>Please complete all required fields for all attendees.</span>
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Basket Summary Section -->
                <BasketSummary
                        {basketItems}
                        {attendees}
                        advancementEventIds={SPEKTRIX_EVENT_IDS}
                        basketLoading={basketLoading}
                        onbasketupdated={handleBasketUpdated}
                        onproceedtocheckout={handleProceedToCheckout}
                />
            </div>
        </div>
    {/if}
</div>
