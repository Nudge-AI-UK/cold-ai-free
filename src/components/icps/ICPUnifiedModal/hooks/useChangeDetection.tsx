import { useState, useEffect, useMemo } from 'react';
import { isEqual } from 'lodash';

export const useChangeDetection = (
  originalData: any,
  currentData: any,
  isEnabled: boolean = true
) => {
  const [changedFields, setChangedFields] = useState<string[]>([]);

  // Deep comparison of data to detect changes
  const detectChanges = () => {
    if (!isEnabled) {
      setChangedFields([]);
      return;
    }

    const changes: string[] = [];

    // Compare each field
    Object.keys(currentData).forEach((key) => {
      const originalValue = originalData[key];
      const currentValue = currentData[key];

      // Handle arrays
      if (Array.isArray(originalValue) || Array.isArray(currentValue)) {
        const orig = originalValue || [];
        const curr = currentValue || [];
        
        if (!isEqual(orig, curr)) {
          changes.push(key);
        }
      }
      // Handle objects (but not arrays)
      else if (
        typeof originalValue === 'object' && 
        originalValue !== null &&
        typeof currentValue === 'object' && 
        currentValue !== null
      ) {
        if (!isEqual(originalValue, currentValue)) {
          changes.push(key);
        }
      }
      // Handle primitives
      else if (originalValue !== currentValue) {
        // Skip if both are empty-ish values
        if (
          (originalValue === '' || originalValue === null || originalValue === undefined) &&
          (currentValue === '' || currentValue === null || currentValue === undefined)
        ) {
          return;
        }
        changes.push(key);
      }
    });

    setChangedFields(changes);
  };

  // Run change detection when data changes
  useEffect(() => {
    detectChanges();
  }, [currentData, originalData, isEnabled]);

  // Calculate if there are any changes
  const hasChanges = changedFields.length > 0;

  // Get summary of changes
  const getChangesSummary = () => {
    const summary: Record<string, { from: any; to: any }> = {};
    
    changedFields.forEach((field) => {
      summary[field] = {
        from: originalData[field],
        to: currentData[field]
      };
    });

    return summary;
  };

  // Reset changes (e.g., after saving)
  const resetChanges = () => {
    setChangedFields([]);
  };

  // Mark a specific field as changed
  const markFieldAsChanged = (field: string) => {
    if (!changedFields.includes(field)) {
      setChangedFields([...changedFields, field]);
    }
  };

  // Unmark a specific field as changed
  const unmarkFieldAsChanged = (field: string) => {
    setChangedFields(changedFields.filter(f => f !== field));
  };

  return {
    hasChanges,
    changedFields,
    resetChanges,
    markFieldAsChanged,
    unmarkFieldAsChanged,
    getChangesSummary
  };
};
