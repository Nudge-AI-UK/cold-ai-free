import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useICPData = (icp: any, shouldLoadMetadata: boolean) => {
  const [formData, setFormData] = useState<any>({});
  const [metadata, setMetadata] = useState<any>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsDataLoading(true);
      
      try {
        // Load basic ICP data
        const basicData = {
          icp_name: icp.icp_name || '',
          description: icp.description || '',
          job_titles: icp.job_titles || [],
          industry_focus: icp.industry_focus || [],
          company_size_range: icp.company_size_range || '',
          pain_points: icp.pain_points || [],
          value_drivers: icp.value_drivers || [],
          company_characteristics: icp.company_characteristics || '',
          geographic_focus: icp.geographic_focus || '',
          budget_range: icp.budget_range || '',
          decision_making_process: icp.decision_making_process || '',
          objections_and_concerns: icp.objections_and_concerns || [],
          success_metrics: icp.success_metrics || [],
          sales_cycle_length: icp.sales_cycle_length || '',
          preferred_communication_channels: icp.preferred_communication_channels || [],
          technology_stack: icp.technology_stack || [],
          competitive_alternatives: icp.competitive_alternatives || [],
          buying_signals: icp.buying_signals || [],
          key_messaging_points: icp.key_messaging_points || [],
          call_to_action: icp.call_to_action || '',
          market_trends: icp.market_trends || '',
          competitive_landscape: icp.competitive_landscape || '',
          growth_opportunities: icp.growth_opportunities || [],
          risk_factors: icp.risk_factors || []
        };

        setFormData(basicData);

        // Load metadata if needed and available
        if (shouldLoadMetadata && icp.metadata) {
          // Parse metadata if it's a string
          const parsedMetadata = typeof icp.metadata === 'string' 
            ? JSON.parse(icp.metadata) 
            : icp.metadata;
          
          setMetadata(parsedMetadata);
        } else if (shouldLoadMetadata && icp.id) {
          // Try to fetch metadata from database if not in the ICP object
          const { data, error } = await supabase
            .from('icps')
            .select('metadata')
            .eq('id', icp.id)
            .single();

          if (data?.metadata) {
            const parsedMetadata = typeof data.metadata === 'string'
              ? JSON.parse(data.metadata)
              : data.metadata;
            setMetadata(parsedMetadata);
          }
        }
      } catch (error) {
        console.error('Error loading ICP data:', error);
      } finally {
        setIsDataLoading(false);
      }
    };

    loadData();
  }, [icp, shouldLoadMetadata]);

  return {
    formData,
    setFormData,
    metadata,
    isDataLoading
  };
};
