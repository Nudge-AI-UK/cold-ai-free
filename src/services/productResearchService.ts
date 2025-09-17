import { supabase } from '@/integrations/supabase/client';
import { n8nService } from './n8nService';

export interface ProductResearchData {
  productName: string;
  description: string;
  features: string[];
  targetMarket: string[];
  valueProposition: string;
  keyBenefits: string[];
  pricing: string;
  competitors: string[];
}

export class ProductResearchService {
  async triggerProductResearch(productLinkId: string, productUrl: string, productName: string) {
    try {
      // Add to research queue
      const { data: queueEntry, error: queueError } = await supabase
        .from('product_research_queue')
        .insert({
          product_link_id: productLinkId,
          status: 'queued'
        })
        .select()
        .single();

      if (queueError) throw queueError;

      // Update product link status to researching
      const { error: updateError } = await supabase
        .from('product_links')
        .update({ status: 'researching' })
        .eq('id', productLinkId);

      if (updateError) throw updateError;

      // Trigger N8N webhook for product research
      const webhookResponse = await n8nService.researchProduct({
        productName,
        productUrl,
        userId: '', // Will be set by auth context
        teamId: undefined
      });

      // Update queue with webhook response
      await supabase
        .from('product_research_queue')
        .update({
          webhook_response: webhookResponse as any,
          status: webhookResponse.success ? 'processing' : 'failed',
          attempts: 1
        })
        .eq('id', queueEntry.id);

      return { success: true, queueId: queueEntry.id };
    } catch (error: any) {
      console.error('Error triggering product research:', error);
      
      // Update status to error
      await supabase
        .from('product_links')
        .update({ status: 'error' })
        .eq('id', productLinkId);

      throw error;
    }
  }

  async checkResearchStatus(productLinkId: string) {
    try {
      const { data, error } = await supabase
        .from('product_research_queue')
        .select('*')
        .eq('product_link_id', productLinkId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error checking research status:', error);
      return null;
    }
  }

  async getResearchResults(productLinkId: string): Promise<ProductResearchData | null> {
    try {
      // Check knowledge base for completed research
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('knowledge_type', 'product_research')
        .ilike('title', '%Product Research:%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      // Parse research data from content
      const researchData: ProductResearchData = {
        productName: data.title.replace('Product Research: ', ''),
        description: data.content || '',
        features: [],
        targetMarket: [],
        valueProposition: '',
        keyBenefits: [],
        pricing: '',
        competitors: []
      };

      // Update product link with research data
      await supabase
        .from('product_links')
        .update({
          status: 'completed',
          research_data: researchData as any,
          last_researched: new Date().toISOString()
        })
        .eq('id', productLinkId);

      return researchData;
    } catch (error) {
      console.error('Error getting research results:', error);
      return null;
    }
  }
}

export const productResearchService = new ProductResearchService();