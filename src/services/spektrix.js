/**
 * Spektrix API Service
 * Following the official Spektrix integration documentation
 */

// Use local proxy path for development, full URL for production
const SPEKTRIX_BASE_URL = import.meta.env.DEV ? '/api/v3' : 'https://spektrix.musicacademy.org/musicacademywest/api/v3';

class SpektrixService {
    constructor() {
        // No need to store basket references - handled via cookies/sessions
    }

    /**
     * Get event details - public endpoint, no auth needed
     */
    async getEventDetails(eventId) {
        try {
            const response = await fetch(`${SPEKTRIX_BASE_URL}/events/${eventId}?$expand=instances`);
            if (!response.ok) throw new Error(`Failed to get event details for ${eventId}`);
            const event = await response.json();
            if (!Array.isArray(event.instances) || event.instances.length !== 1) {
                throw new Error(`Event ${eventId} must have exactly one instance`);
            }
            event.instance = event.instances[0];
            delete event.instances;

            // Parse meal options from the instance attribute if present
            if (event.instance.attribute_WebMealOptions) {
                try {
                    event.instance.mealOptions = await this.parseMealOptions(event.instance.attribute_WebMealOptions);
                    delete event.instance.attribute_WebMealOptions;
                } catch (mealOptionsError) {
                    throw new Error(`Failed to parse meal options for event ${eventId}: ${mealOptionsError.message}`);
                }
            } else {
                throw new Error(`Event ${eventId} is missing required attribute_WebMealOptions`);
            }

            return event;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get instance status/availability - includes availability for all areas
     */
    async getInstanceStatus(instanceId) {
        try {
            const response = await fetch(`${SPEKTRIX_BASE_URL}/instances/${instanceId}/status?includeChildPlans=true&includeLockInformation=true`);
            if (!response.ok) throw new Error(`Failed to get status for instance ${instanceId}`);
            return await response.json();
        } catch (error) {
            console.error(`Error getting status for instance ${instanceId}:`, error);
            throw error;
        }
    }

    /**
     * Get area-specific status for detailed availability checking
     */
    async getInstanceAreaStatus(instanceId, areaId) {
        try {
            const response = await fetch(`${SPEKTRIX_BASE_URL}/instances/${instanceId}/status/areas/${areaId}?includeLockInformation=true`);
            if (!response.ok) throw new Error(`Failed to get area status for instance ${instanceId}, area ${areaId}`);
            return await response.json();
        } catch (error) {
            console.error(`Error getting area status for instance ${instanceId}, area ${areaId}:`, error);
            throw error;
        }
    }

    /**
     * Get price list (ticket types) for an instance
     */
    async getInstancePriceList(instanceId) {
        try {
            const response = await fetch(`${SPEKTRIX_BASE_URL}/instances/${instanceId}/price-list`);
            if (!response.ok) throw new Error(`Failed to get price list for instance ${instanceId}`);
            return await response.json();
        } catch (error) {
            console.error(`Error getting price list for instance ${instanceId}:`, error);
            throw error;
        }
    }

    /**
     * Get seating plan details for an instance
     */
    async getInstancePlan(instanceId) {
        try {
            const response = await fetch(`${SPEKTRIX_BASE_URL}/instances/${instanceId}/plan`);
            if (!response.ok) throw new Error(`Failed to get plan for instance ${instanceId}`);
            return await response.json();
        } catch (error) {
            console.error(`Error getting plan for instance ${instanceId}:`, error);
            throw error;
        }
    }

    /**
     * Add tickets to basket - client-side call with credentials
     * Using the correct format from the documentation:
     * [{ "instance": "instanceId", "seatingPlan": "planId", "type": "ticketTypeId" }]
     */
    async addTicketsToBasket(tickets) {
        try {
            // Transform tickets to the correct format expected by Spektrix API
            const formattedTickets = tickets.map(ticket => ({
                instance: ticket.instanceId,
                seatingPlan: ticket.planId,
                type: ticket.ticketTypeId
            }));

            const response = await fetch(`${SPEKTRIX_BASE_URL}/basket/tickets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Essential for session management
                body: JSON.stringify(formattedTickets)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to add tickets to basket');
            }

            return await response.json();
        } catch (error) {
            console.error('Error adding tickets to basket:', error);
            throw error;
        }
    }

    /**
     * Update ticket attributes using PATCH
     * Format from documentation: [{ "attribute_Name": "value" }]
     */
    async updateTicketAttributes(ticketId, attributes) {
        try {
            // Transform attributes to the correct format expected by Spektrix API
            const formattedAttributes = [attributes];
            const url = `${SPEKTRIX_BASE_URL}/basket/tickets/${ticketId}`;
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formattedAttributes)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update ticket attributes');
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get current basket contents using the Custom Baskets API
     */
    async getBasketContents() {
        try {
            const response = await fetch(`${SPEKTRIX_BASE_URL}/basket?$expand=tickets/event,tickets/instance`, {
                credentials: 'include' // Essential for custom baskets
            });

            if (response.status === 404) {
                // No basket exists
                return {
                    items: [],
                    tickets: [],
                };
            }

            if (!response.ok) {
                throw new Error('Failed to get basket contents');
            }

            return await response.json();
        } catch (error) {
            return {
                items: [],
                tickets: [],
            };
        }
    }

    /**
     * Remove tickets from basket by ticket IDs
     */
    async removeTickets(ticketIds) {
        try {
            const idsParam = Array.isArray(ticketIds) ? ticketIds.join(',') : ticketIds;
            const response = await fetch(`${SPEKTRIX_BASE_URL}/basket/tickets?ticketIds=${idsParam}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to remove tickets from basket');

            return true;
        } catch (error) {
            console.error('Error removing tickets from basket:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive availability data for an instance including individual area status
     */
    async getInstanceAvailabilityData(instanceId) {
        try {
            // First get the overall status, price list, and plan
            const [status, priceList, plan] = await Promise.all([
                this.getInstanceStatus(instanceId),
                this.getInstancePriceList(instanceId),
                this.getInstancePlan(instanceId)]);

            // Then get individual area status for each area in the plan
            const areaStatusPromises = plan.areas?.map(area => this.getInstanceAreaStatus(instanceId, area.id)
                .then(areaStatus => ({
                    areaId: area.id,
                    status: areaStatus
                }))
                .catch(error => {
                    console.warn(`Failed to get status for area ${area.id}:`, error);
                    return {
                        areaId: area.id,
                        status: null
                    };
                })) || [];

            const areaStatuses = await Promise.all(areaStatusPromises);

            // Create a map of area statuses for easy lookup
            const areaStatusMap = {};
            areaStatuses.forEach(({
                                      areaId,
                                      status: areaStatus
                                  }) => {
                if (areaStatus) {
                    areaStatusMap[areaId] = areaStatus;
                }
            });

            return {
                status,
                priceList,
                plan,
                areaStatuses: areaStatusMap
            };
        } catch (error) {
            console.error(`Error getting comprehensive availability data for instance ${instanceId}:`, error);
            throw error;
        }
    }

    /**
     * Parse instance meal options from an instance attribute string
     */
    async parseMealOptions(mealOptions) {
        if (!mealOptions || typeof mealOptions !== 'string' || !mealOptions.trim()) {
            throw new Error('Meal options string is empty.');
        }

        const allowedValues = new Set([
            'Meat',
            'Fish',
            'Vegetarian',
            'TBD']);
        const seenValues = new Set();
        const seenLabels = new Set();
        const parsedOptions = [];

        for (const pair of mealOptions.split(';')) {
            const trimmed = pair.trim();
            if (!trimmed) continue;

            // Match: Value=Label or Value="Label with spaces"
            const match = trimmed.match(/^("?[\w\s]+"?)=(?:"([^"]+)"|([^"]+))$/);
            if (!match) continue;

            let value = match[1].replace(/"/g, '').trim();
            let label = (match[2] ?? match[3]).trim();

            if (!allowedValues.has(value)) continue;
            if (!label) continue;
            if (seenValues.has(value) || seenLabels.has(label)) continue;

            seenValues.add(value);
            seenLabels.add(label);
            parsedOptions.push({
                value,
                label
            });
        }

        if (parsedOptions.length === 0) {
            throw new Error('No valid meal options found.');
        }

        // Prepend default
        return [
            {
                value: '',
                label: 'Select meal...'
            },
            ...parsedOptions];
    }

}

export const spektrixService = new SpektrixService();
